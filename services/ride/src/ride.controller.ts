import { Body, Controller, Get, Param, Post, Res, HttpStatus, Logger, Req, Query, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, Outbox } from './entities';
import { EventBus } from './event-bus';
import { Request, Response } from 'express';
import {
  refreshRideGauges,
  rideLockAttemptCounter,
  rideLockLatencyHistogram,
  ridePriceHistogram,
  ridePublishedCounter,
} from './metrics';
import axios from 'axios';

const IDENTITY_URL = process.env.IDENTITY_URL || 'http://identity:3000';
const METRICS_REFRESH_DEBOUNCE_MS = 5000;

@Controller('rides')
export class RideController {
  private readonly logger = new Logger(RideController.name);
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private refreshInFlight = false;

  constructor(
    @InjectRepository(Ride) private rides: Repository<Ride>,
    @InjectRepository(Outbox) private outboxes: Repository<Outbox>,
    private bus: EventBus,
  ) {
    void this.refreshAggregates();
  }

  private buildRideEvent(ride: Ride) {
    return {
      rideId: ride.id,
      status: ride.status,
      driverId: ride.driverId,
      driverLabel: ride.driverLabel,
      driverPhotoUrl: ride.driverPhotoUrl,
      driverEmailVerified: ride.driverEmailVerified,
      driverPhoneVerified: ride.driverPhoneVerified,
      driverVerified: ride.driverVerified,
      comfortLevel: ride.comfortLevel,
      estimatedDurationMinutes: ride.estimatedDurationMinutes,
      stops: ride.stops,
      originCity: ride.originCity,
      destinationCity: ride.destinationCity,
      departureAt: ride.departureAt,
      pricePerSeat: ride.pricePerSeat,
      seatsTotal: ride.seatsTotal,
      seatsAvailable: ride.seatsAvailable,
      liveTrackingEnabled: ride.liveTrackingEnabled,
      liveTrackingMode: ride.liveTrackingMode,
      cancelledAt: ride.cancelledAt ?? null,
    };
  }

  private async refreshAggregates() {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      await refreshRideGauges(this.rides);
    } catch (err) {
      this.logger.warn(`refreshAggregates failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this.refreshInFlight = false;
    }
  }

  private queueRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshAggregates();
    }, METRICS_REFRESH_DEBOUNCE_MS);
  }

  @Post()
  async create(@Body() dto: Partial<Ride>, @Req() req: Request, @Res() res: Response) {
    try {
      let driverId = dto.driverId;
      let driverLabel = dto.driverLabel ?? null;
      let driverPhotoUrl = dto.driverPhotoUrl ?? null;
      let driverEmailVerified = Boolean(dto.driverEmailVerified);
      let driverPhoneVerified = Boolean(dto.driverPhoneVerified);
      let driverVerified = Boolean(dto.driverVerified);

      if (!driverId) {
        const authHeader = req.headers['authorization'];
        if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
          const profile = await this.fetchProfile(authHeader);
          if (profile?.id) {
            driverId = profile.id;
            driverLabel = driverLabel ?? profile.fullName ?? profile.companyName ?? profile.email ?? null;
            driverPhotoUrl = driverPhotoUrl ?? profile.profilePhotoUrl ?? null;
            driverEmailVerified = Boolean(profile.emailVerifiedAt);
            driverPhoneVerified = Boolean(profile.phoneVerifiedAt);
            driverVerified = driverEmailVerified && driverPhoneVerified;
          }
        }
      }

      if (!driverId) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'driver_required' });
      }
      const liveTrackingEnabled = Boolean(dto.liveTrackingEnabled);
      const liveTrackingMode = dto.liveTrackingMode === 'CITY_ALERTS' ? 'CITY_ALERTS' : 'FULL';
      const ride = this.rides.create({
        driverId,
        driverLabel,
        driverPhotoUrl,
        driverEmailVerified,
        driverPhoneVerified,
        driverVerified,
        comfortLevel: dto.comfortLevel ?? null,
        estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
        stops: dto.stops ?? null,
        originCity: dto.originCity!,
        destinationCity: dto.destinationCity!,
        departureAt: dto.departureAt!,
        seatsTotal: dto.seatsTotal!,
        seatsAvailable: dto.seatsAvailable ?? dto.seatsTotal!,
        pricePerSeat: dto.pricePerSeat!,
        status: 'PUBLISHED',
        liveTrackingEnabled,
        liveTrackingMode,
      });
      const saved = await this.rides.save(ride);

      const evt = this.buildRideEvent(saved);

      // Kafka
      await this.bus.publish('ride.published', evt, saved.id);
      // Outbox (optionnel mais utile pour observabilité)
      await this.outboxes.save(this.outboxes.create({ topic: 'ride.published', payload: evt, sent: false }));

      ridePublishedCounter.inc({ origin_city: saved.originCity, destination_city: saved.destinationCity });
      ridePriceHistogram.observe(saved.pricePerSeat);
      this.queueRefresh();

      return res.status(HttpStatus.CREATED).json(saved);
    } catch (e: any) {
      this.logger.error(`Ride creation failed: ${e?.message ?? e}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'create_failed', detail: e?.message });
    }
  }

  private async fetchProfile(authorization: string) {
    try {
      const { data } = await axios.get(`${IDENTITY_URL}/profiles/me`, {
        headers: { authorization },
        timeout: 3000,
      });
      return data;
    } catch (err) {
      this.logger.warn(`Unable to resolve driver profile: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private async resolveDriverId(req: Request, fallback?: string) {
    if (fallback) return fallback;
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      const profile = await this.fetchProfile(authHeader);
      if (profile?.id) {
        return profile.id as string;
      }
    }
    return undefined;
  }

  private async ensureDriverAccess(req: Request, ride: Ride) {
    const driverId = await this.resolveDriverId(req, ride.driverId);
    if (!driverId || driverId !== ride.driverId) {
      throw new ForbiddenException('driver_required');
    }
  }

  private summarizeRides(rides: Ride[]) {
    const now = Date.now();
    const upcoming = rides.filter((ride) => {
      const ts = Date.parse(ride.departureAt);
      return Number.isFinite(ts) && ts > now;
    }).length;
    const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
    const seatsBooked = rides.reduce((acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable), 0);
    const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
    return { upcoming, published, seatsBooked, seatsTotal };
  }

  @Get('mine')
  async listMine(@Req() req: Request, @Query() query: any, @Res() res: Response) {
    try {
      const driverId = await this.resolveDriverId(req, query?.driverId);
      if (!driverId) {
        throw new ForbiddenException('driver_required');
      }

      const limit = Math.min(Math.max(Number(query?.limit ?? 50) || 50, 1), 200);
      const offset = Math.max(Number(query?.offset ?? 0) || 0, 0);

      const qb = this.rides.createQueryBuilder('ride').where('ride.driverId = :driverId', { driverId });

      if (query?.status) {
        qb.andWhere('ride.status = :status', { status: query.status });
      }
      if (query?.origin) {
        qb.andWhere('ride.originCity ILIKE :origin', { origin: `%${query.origin}%` });
      }
      if (query?.destination) {
        qb.andWhere('ride.destinationCity ILIKE :destination', { destination: `%${query.destination}%` });
      }
      if (query?.departureAfter) {
        qb.andWhere('ride.departureAt >= :departureAfter', { departureAfter: query.departureAfter });
      }
      if (query?.departureBefore) {
        qb.andWhere('ride.departureAt <= :departureBefore', { departureBefore: query.departureBefore });
      }

      const sort = (query?.sort as string)?.toLowerCase();
      if (sort === 'price_asc') qb.orderBy('ride.pricePerSeat', 'ASC');
      else if (sort === 'price_desc') qb.orderBy('ride.pricePerSeat', 'DESC');
      else if (sort === 'departure_asc') qb.orderBy('ride.departureAt', 'ASC');
      else qb.orderBy('ride.departureAt', 'DESC');

      qb.skip(offset);
      qb.take(limit);

      const [items, total] = await qb.getManyAndCount();

      return res.status(HttpStatus.OK).json({
        data: items,
        total,
        offset,
        limit,
        summary: this.summarizeRides(items),
      });
    } catch (err: any) {
      const status =
        err instanceof ForbiddenException
          ? HttpStatus.FORBIDDEN
          : err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({ error: err?.message ?? 'mine_failed' });
    }
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const ride = await this.rides.findOne({ where: { id } });
    return ride ?? { error: 'not_found' };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: Request) {
    const ride = await this.rides.findOne({ where: { id } });
    if (!ride) {
      return { error: 'not_found' };
    }
    await this.ensureDriverAccess(req, ride);
    if (ride.status === 'CLOSED') {
      return { ok: true, status: ride.status };
    }
    const reason = body?.reason?.trim();
    ride.status = 'CLOSED';
    ride.cancelledAt = new Date();
    ride.cancellationReason = reason || null;
    await this.rides.save(ride);
    await this.bus.publish('ride.updated', this.buildRideEvent(ride), ride.id);
    this.queueRefresh();

    const windowMinutes = Number(process.env.CANCEL_PENALTY_WINDOW_MIN ?? 120);
    const penaltyAmount = Number(process.env.CANCEL_PENALTY_AMOUNT ?? 0);
    let penalty = 0;
    if (windowMinutes > 0 && penaltyAmount > 0) {
      const dep = Date.parse(ride.departureAt);
      const diff = Number.isFinite(dep) ? (dep - Date.now()) / 60000 : Infinity;
      if (diff <= windowMinutes) {
        penalty = penaltyAmount;
      }
    }

    return { ok: true, status: ride.status, penalty };
  }

  @Post(':id/reschedule')
  async reschedule(@Param('id') id: string, @Body() body: { departureAt?: string }, @Req() req: Request) {
    const ride = await this.rides.findOne({ where: { id } });
    if (!ride) {
      return { error: 'not_found' };
    }
    await this.ensureDriverAccess(req, ride);
    if (!body?.departureAt) {
      return { error: 'departure_required' };
    }
    ride.departureAt = body.departureAt;
    ride.cancelledAt = null;
    ride.cancellationReason = null;
    ride.status = 'PUBLISHED';
    await this.rides.save(ride);
    await this.bus.publish('ride.updated', this.buildRideEvent(ride), ride.id);
    this.queueRefresh();
    return { ok: true, ride };
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
      await this.bus.publish('ride.updated', this.buildRideEvent(ride), ride.id);
      rideLockAttemptCounter.inc({ result: 'success' });
      this.queueRefresh();
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
