import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities';
import { InternalGuard } from './internal.guard';

type ListQuery = {
  passengerId?: string;
  rideId?: string;
  status?: string;
  limit?: string;
  offset?: string;
};

@Controller('admin/bookings')
@UseGuards(InternalGuard)
export class AdminBookingController {
  constructor(@InjectRepository(Booking) private readonly bookings: Repository<Booking>) {}

  @Get()
  async list(@Query() query: ListQuery) {
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 200);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

    const qb = this.bookings.createQueryBuilder('booking');

    if (query.passengerId) {
      qb.andWhere('booking.passengerId = :passengerId', { passengerId: query.passengerId });
    }
    if (query.rideId) {
      qb.andWhere('booking.rideId = :rideId', { rideId: query.rideId });
    }
    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    qb.orderBy('booking.createdAt', 'DESC');
    qb.skip(offset);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      total,
      offset,
      limit,
      summary: this.computeSummary(items),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.bookings.findOne({ where: { id } });
  }

  private computeSummary(bookings: Booking[]) {
    const byStatus: Record<string, number> = {};
    let amountTotal = 0;
    let seatsTotal = 0;

    for (const booking of bookings) {
      byStatus[booking.status] = (byStatus[booking.status] ?? 0) + 1;
      amountTotal += booking.amount ?? 0;
      seatsTotal += booking.seats ?? 0;
    }

    return { byStatus, amountTotal, seatsTotal };
  }
}
