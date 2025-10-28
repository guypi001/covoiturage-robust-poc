import { Body, Controller, Get, Param, Post, Res, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, Outbox } from './entities';
import { EventBus } from './event-bus';
import { Response } from 'express';
import {
  refreshRideGauges,
  rideLockAttemptCounter,
  rideLockLatencyHistogram,
  ridePriceHistogram,
  ridePublishedCounter,
} from './metrics';

@Controller('rides')
export class RideController {
  private readonly logger = new Logger(RideController.name);

  constructor(
    @InjectRepository(Ride) private rides: Repository<Ride>,
    @InjectRepository(Outbox) private outboxes: Repository<Outbox>,
    private bus: EventBus,
  ) {
    void this.refreshAggregates();
  }

  private async refreshAggregates() {
    try {
      await refreshRideGauges(this.rides);
    } catch (err) {
      this.logger.warn(`refreshAggregates failed: ${(err as Error)?.message ?? err}`);
    }
  }

  @Post()
  async create(@Body() dto: Partial<Ride>, @Res() res: Response) {
    try {
      const ride = this.rides.create({
        driverId: dto.driverId!,
        originCity: dto.originCity!,
        destinationCity: dto.destinationCity!,
        departureAt: dto.departureAt!,
        seatsTotal: dto.seatsTotal!,
        seatsAvailable: dto.seatsAvailable ?? dto.seatsTotal!,
        pricePerSeat: dto.pricePerSeat!,
        status: 'PUBLISHED',
      });
      const saved = await this.rides.save(ride);

      const evt = {
        rideId: saved.id,
        status: saved.status,
        driverId: saved.driverId,
        originCity: saved.originCity,
        destinationCity: saved.destinationCity,
        departureAt: saved.departureAt,
        pricePerSeat: saved.pricePerSeat,
        seatsTotal: saved.seatsTotal,
        seatsAvailable: saved.seatsAvailable,
      };

      // Kafka
      await this.bus.publish('ride.published', evt, saved.id);
      // Outbox (optionnel mais utile pour observabilité)
      await this.outboxes.save(this.outboxes.create({ topic: 'ride.published', payload: evt, sent: false }));

      ridePublishedCounter.inc({ origin_city: saved.originCity, destination_city: saved.destinationCity });
      ridePriceHistogram.observe(saved.pricePerSeat);
      await this.refreshAggregates();

      return res.status(HttpStatus.CREATED).json(saved);
    } catch (e: any) {
      this.logger.error(`Ride creation failed: ${e?.message ?? e}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'create_failed', detail: e?.message });
    }
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const ride = await this.rides.findOne({ where: { id } });
    return ride ?? { error: 'not_found' };
  }

  // Utilisé par "booking" pour réserver des places
  @Post(':id/lock')
  async lock(@Param('id') id: string, @Body() body: { seats: number }, @Res() res: Response) {
    const endTimer = rideLockLatencyHistogram.startTimer();
    try {
      const ride = await this.rides.findOne({ where: { id } });
      if (!ride) {
        rideLockAttemptCounter.inc({ result: 'not_found' });
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'not_found' });
      }

      const n = Number(body?.seats ?? 1);
      if (!Number.isFinite(n) || n <= 0) {
        rideLockAttemptCounter.inc({ result: 'invalid_request' });
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'invalid_seats' });
      }
      if (ride.seatsAvailable < n) {
        rideLockAttemptCounter.inc({ result: 'conflict' });
        return res.status(HttpStatus.CONFLICT).json({ error: 'not_enough_seats' });
      }

      ride.seatsAvailable -= n;
      await this.rides.save(ride);
      rideLockAttemptCounter.inc({ result: 'success' });
      await this.refreshAggregates();
      return res.status(HttpStatus.OK).json({ ok: true, seatsAvailable: ride.seatsAvailable });
    } catch (err: any) {
      rideLockAttemptCounter.inc({ result: 'error' });
      this.logger.error(`Ride lock failed: ${err?.message ?? err}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'lock_failed' });
    } finally {
      endTimer();
    }
  }
}
