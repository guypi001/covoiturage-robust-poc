import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ride } from './entities';
import { InternalGuard } from './internal.guard';
import { AdminUpdateRideDto } from './dto';

type ListQuery = {
  driverId?: string;
  status?: string;
  search?: string;
  limit?: string;
  offset?: string;
  departureAfter?: string;
  departureBefore?: string;
  origin?: string;
  destination?: string;
  sort?: string;
};

@Controller('admin/rides')
@UseGuards(InternalGuard)
export class AdminRideController {
  constructor(@InjectRepository(Ride) private readonly rides: Repository<Ride>) {}

  @Get()
  async list(@Query() query: ListQuery) {
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 500);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const qb = this.rides.createQueryBuilder('ride');

    if (query.driverId) {
      qb.andWhere('ride.driverId = :driverId', { driverId: query.driverId });
    }
    if (query.status) {
      qb.andWhere('ride.status = :status', { status: query.status });
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      qb.andWhere('(ride.originCity ILIKE :pattern OR ride.destinationCity ILIKE :pattern)', {
        pattern,
      });
    }

    if (query.origin) {
      qb.andWhere('ride.originCity ILIKE :origin', { origin: `%${query.origin.trim()}%` });
    }
    if (query.destination) {
      qb.andWhere('ride.destinationCity ILIKE :destination', {
        destination: `%${query.destination.trim()}%`,
      });
    }

    if (query.departureAfter) {
      qb.andWhere('ride.departureAt >= :departureAfter', {
        departureAfter: query.departureAfter,
      });
    }
    if (query.departureBefore) {
      qb.andWhere('ride.departureAt <= :departureBefore', {
        departureBefore: query.departureBefore,
      });
    }

    const sort = query.sort?.toLowerCase();
    if (sort === 'departure_asc') {
      qb.orderBy('ride.departureAt', 'ASC');
    } else if (sort === 'departure_desc') {
      qb.orderBy('ride.departureAt', 'DESC');
    } else if (sort === 'price_asc') {
      qb.orderBy('ride.pricePerSeat', 'ASC');
    } else if (sort === 'price_desc') {
      qb.orderBy('ride.pricePerSeat', 'DESC');
    } else {
      qb.orderBy('ride.createdAt', 'DESC');
    }

    qb.skip(offset);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    const summary = this.computeSummary(items);

    return {
      data: items,
      total,
      offset,
      limit,
      summary,
    };
  }

  @Get('batch')
  async batch(@Query('ids') ids?: string) {
    const list = typeof ids === 'string'
      ? ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 200)
      : [];
    if (!list.length) {
      return { data: [] };
    }
    const items = await this.rides.find({ where: { id: In(list) } });
    return { data: items };
  }

  @Get(':id')
	async detail(@Param('id') id: string) {
    return this.rides.findOne({ where: { id } });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: AdminUpdateRideDto) {
    const ride = await this.rides.findOne({ where: { id } });
    if (!ride) {
      throw new NotFoundException('ride_not_found');
    }

    const reservedSeats = ride.seatsTotal - ride.seatsAvailable;
    const nextTotal = dto.seatsTotal ?? ride.seatsTotal;
    if (nextTotal < reservedSeats) {
      throw new BadRequestException('seats_total_too_low');
    }

    let nextAvailable = dto.seatsAvailable ?? ride.seatsAvailable;
    if (dto.seatsTotal !== undefined && dto.seatsAvailable === undefined) {
      nextAvailable = Math.max(0, nextTotal - reservedSeats);
    }

    if (nextAvailable > nextTotal) {
      throw new BadRequestException('seats_available_too_high');
    }

    if (dto.originCity !== undefined) {
      const trimmed = dto.originCity.trim();
      if (!trimmed) {
        throw new BadRequestException('origin_required');
      }
      ride.originCity = trimmed;
    }

    if (dto.destinationCity !== undefined) {
      const trimmed = dto.destinationCity.trim();
      if (!trimmed) {
        throw new BadRequestException('destination_required');
      }
      ride.destinationCity = trimmed;
    }

    if (dto.departureAt) {
      if (!Number.isFinite(Date.parse(dto.departureAt))) {
        throw new BadRequestException('invalid_departure');
      }
      ride.departureAt = new Date(dto.departureAt).toISOString();
    }

    if (dto.pricePerSeat !== undefined) {
      ride.pricePerSeat = dto.pricePerSeat;
    }

    ride.seatsTotal = nextTotal;
    ride.seatsAvailable = nextAvailable;

    if (dto.status) {
      ride.status = dto.status;
      if (dto.status === 'CLOSED') {
        ride.seatsAvailable = 0;
      }
    }

    return this.rides.save(ride);
  }

  @Post(':id/close')
  async close(@Param('id') id: string) {
    const ride = await this.rides.findOne({ where: { id } });
    if (!ride) {
      throw new NotFoundException('ride_not_found');
    }

    ride.status = 'CLOSED';
    ride.seatsAvailable = 0;
    return this.rides.save(ride);
  }

  private computeSummary(rides: Ride[]) {
    const now = Date.now();
    const upcoming = rides.filter((ride) => {
      const ts = Date.parse(ride.departureAt);
      return Number.isFinite(ts) && ts > now;
    }).length;
    const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
    const seatsBooked = rides.reduce(
      (acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable),
      0,
    );
    const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
    const averagePrice =
      rides.length > 0
        ? Math.round(
            rides.reduce((acc, ride) => acc + ride.pricePerSeat, 0) / rides.length,
          )
        : 0;
    const occupancyRate = seatsTotal > 0 ? seatsBooked / seatsTotal : 0;
    const byStatus = rides.reduce<Record<string, number>>((acc, ride) => {
      acc[ride.status] = (acc[ride.status] ?? 0) + 1;
      return acc;
    }, {});
    const routeCount = rides.reduce<Record<string, { origin: string; destination: string; count: number }>>(
      (acc, ride) => {
        const key = `${ride.originCity}→${ride.destinationCity}`;
        if (!acc[key]) {
          acc[key] = {
            origin: ride.originCity,
            destination: ride.destinationCity,
            count: 0,
          };
        }
        acc[key].count += 1;
        return acc;
      },
      {},
    );
    const topRoutes = Object.values(routeCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { upcoming, published, seatsBooked, seatsTotal, averagePrice, occupancyRate, byStatus, topRoutes };
  }
}
