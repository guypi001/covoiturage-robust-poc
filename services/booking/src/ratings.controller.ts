import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, Rating, RatingRole } from './entities';
import { http } from './utils';

const RIDE_URL = process.env.RIDE_URL || 'http://ride:3000';

type CreateRatingPayload = {
  bookingId?: string;
  raterId?: string;
  raterRole?: RatingRole;
  punctuality?: number;
  driving?: number;
  cleanliness?: number;
};

const clampScore = (value: any) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
};

@Controller('ratings')
export class RatingsController {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
  ) {}

  @Get('booking/:bookingId')
  async getByBooking(
    @Param('bookingId') bookingId: string,
    @Query('raterId') raterId?: string,
  ) {
    if (!bookingId?.trim() || !raterId?.trim()) {
      throw new BadRequestException('booking_or_rater_required');
    }
    const rating = await this.ratings.findOne({ where: { bookingId, raterId } });
    return rating || { exists: false };
  }

  @Get('summary/:accountId')
  async summary(@Param('accountId') accountId: string) {
    if (!accountId?.trim()) {
      throw new BadRequestException('account_required');
    }
    const row = await this.ratings
      .createQueryBuilder('r')
      .select('COUNT(*)', 'count')
      .addSelect('AVG(r.punctuality)', 'punctuality')
      .addSelect('AVG(r.driving)', 'driving')
      .addSelect('AVG(r.cleanliness)', 'cleanliness')
      .where('r.ratee_id = :accountId', { accountId })
      .getRawOne<{ count: string; punctuality: string | null; driving: string | null; cleanliness: string | null }>();
    const count = Number(row?.count ?? 0);
    const punctuality = row?.punctuality ? Number(row.punctuality) : 0;
    const driving = row?.driving ? Number(row.driving) : 0;
    const cleanliness = row?.cleanliness ? Number(row.cleanliness) : 0;
    const overall = count ? (punctuality + driving + cleanliness) / 3 : 0;
    return {
      accountId,
      count,
      averages: {
        punctuality,
        driving,
        cleanliness,
        overall,
      },
    };
  }

  @Post()
  async create(@Body() body: CreateRatingPayload) {
    const bookingId = body?.bookingId?.trim();
    const raterId = body?.raterId?.trim();
    const raterRole = body?.raterRole;
    const punctuality = clampScore(body?.punctuality);
    const driving = clampScore(body?.driving);
    const cleanliness = clampScore(body?.cleanliness);

    if (!bookingId || !raterId || !raterRole) {
      throw new BadRequestException('missing_fields');
    }
    if (!['PASSENGER', 'DRIVER'].includes(raterRole)) {
      throw new BadRequestException('invalid_role');
    }
    if (!punctuality || !driving || !cleanliness) {
      throw new BadRequestException('invalid_scores');
    }

    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('booking_not_found');
    }
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('booking_cancelled');
    }

    const existing = await this.ratings.findOne({ where: { bookingId, raterId } });
    if (existing) {
      throw new ConflictException('rating_exists');
    }

    let ride: any;
    try {
      ride = (await http({ method: 'GET', url: `${RIDE_URL}/rides/${booking.rideId}` })).data;
    } catch (err) {
      throw new BadRequestException('ride_not_found');
    }
    if (!ride?.driverId) {
      throw new BadRequestException('ride_invalid');
    }
    if (ride?.status !== 'CLOSED') {
      throw new BadRequestException('ride_not_completed');
    }

    let rateeId: string;
    if (raterRole === 'PASSENGER') {
      if (booking.passengerId !== raterId) {
        throw new ForbiddenException('not_passenger');
      }
      rateeId = ride.driverId;
    } else {
      if (ride.driverId !== raterId) {
        throw new ForbiddenException('not_driver');
      }
      rateeId = booking.passengerId;
    }

    const rating = this.ratings.create({
      bookingId,
      rideId: booking.rideId,
      raterId,
      rateeId,
      raterRole,
      punctuality,
      driving,
      cleanliness,
    });
    return this.ratings.save(rating);
  }
}
