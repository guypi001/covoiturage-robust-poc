import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride } from './entities';
import { InternalGuard } from './internal.guard';

type ListQuery = {
  driverId?: string;
  status?: string;
  search?: string;
  limit?: string;
  offset?: string;
};

@Controller('admin/rides')
@UseGuards(InternalGuard)
export class AdminRideController {
  constructor(@InjectRepository(Ride) private readonly rides: Repository<Ride>) {}

  @Get()
  async list(@Query() query: ListQuery) {
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 200);
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

    qb.orderBy('ride.createdAt', 'DESC');
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

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.rides.findOne({ where: { id } });
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
    return { upcoming, published, seatsBooked, seatsTotal };
  }
}
