// services/booking/src/booking.controller.ts
import { Body, Controller, Get, Param, Post, Res, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities';
import { CreateBookingDto } from './dto';
import { http } from './utils';
import { EventBus } from './event-bus';
import { Response } from 'express';
import {
  bookingAmountHistogram,
  bookingCreatedCounter,
  bookingFailureCounter,
  bookingSeatsHistogram,
  refreshBookingGauges,
} from './metrics';

// ⚠️ En réseau Docker, "ride" écoute sur 3000 (pas 3002).
const RIDE_URL   = process.env.RIDE_URL   || 'http://ride:3000';
const WALLET_URL = process.env.WALLET_URL || 'http://wallet:3000';
const METRICS_REFRESH_DEBOUNCE_MS = 5000;

@Controller('bookings')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private refreshInFlight = false;

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly bus: EventBus,
  ) {
    void this.refreshAggregates();
  }

  private async refreshAggregates() {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      await refreshBookingGauges(this.bookings);
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

  @Get(':id')
  async get(@Param('id') id: string) {
    const b = await this.bookings.findOne({ where: { id } });
    return b || { error: 'not_found' };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: any, @Res() res: Response) {
    const passengerId = body?.passengerId;
    if (!passengerId || typeof passengerId !== 'string') {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'passenger_required' });
    }
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'not_found' });
    }
    if (booking.passengerId !== passengerId) {
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'forbidden' });
    }
    if (booking.status === 'CANCELLED') {
      return res.status(HttpStatus.OK).json(booking);
    }
    booking.status = 'CANCELLED';
    const saved = await this.bookings.save(booking);
    this.queueRefresh();
    return res.status(HttpStatus.OK).json(saved);
  }

  @Post()
  async create(@Body() dto: CreateBookingDto, @Res() res: Response) {
    // 1) lock des sièges côté ride
    try {
      await http({ method: 'POST', url: `${RIDE_URL}/rides/${dto.rideId}/lock`, data: { seats: dto.seats } });
    } catch (e: any) {
      bookingFailureCounter.inc({ reason: 'seat_lock' });
      this.logger.warn(`Seat lock failed for ride ${dto.rideId}: ${e?.message ?? e}`);
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Seat lock failed', detail: e?.message });
    }

    // 2) calcul du montant
    let amount = 0;
    let rideDetails: any;
    try {
      const ride = (await http({ method: 'GET', url: `${RIDE_URL}/rides/${dto.rideId}` })).data;
      rideDetails = ride;
      amount = (ride?.pricePerSeat || 0) * dto.seats;
    } catch (e: any) {
      this.logger.warn(`Impossible de récupérer le prix du trajet ${dto.rideId}: ${e?.message ?? e}`);
    }

    // 3) création réservation
    let saved: Booking;
    try {
      const booking = this.bookings.create({ ...dto, amount, status: 'CONFIRMED' });
      saved = await this.bookings.save(booking);
      bookingCreatedCounter.inc({ status: booking.status });
      bookingSeatsHistogram.observe(dto.seats);
      if (amount > 0) bookingAmountHistogram.observe(amount);
    } catch (e: any) {
      bookingFailureCounter.inc({ reason: 'persist' });
      this.logger.error(`Persist booking failed: ${e?.message ?? e}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'persist_failed', detail: e?.message });
    }

    // 4) création d’un hold côté wallet
    try {
      const hold = (await http({
        method: 'POST',
        url: `${WALLET_URL}/holds`,
        data: { ownerId: dto.passengerId, referenceId: saved.id, amount },
      })).data;

      saved.holdId = hold.id;              // ✅ propriété camelCase
      await this.bookings.save(saved);
    } catch (e: any) {
      bookingFailureCounter.inc({ reason: 'wallet_hold' });
      this.logger.warn(`Wallet hold failed for booking ${saved.id}: ${e?.message ?? e}`);
    }

    // 5) émission de l’intention de paiement
    try {
      await this.bus.publish(
        'payment.intent',
        { bookingId: saved.id, amount, currency: 'XOF', holdId: saved.holdId },
        saved.id,
      );
    } catch (e: any) {
      bookingFailureCounter.inc({ reason: 'event_bus' });
      this.logger.error(`Kafka publish failed for booking ${saved.id}: ${e?.message ?? e}`);
    }

    try {
      await this.bus.publish(
        'booking.confirmed',
        {
          bookingId: saved.id,
          passengerId: saved.passengerId,
          rideId: saved.rideId,
          seats: saved.seats,
          amount,
          originCity: rideDetails?.originCity,
          destinationCity: rideDetails?.destinationCity,
          departureAt: rideDetails?.departureAt,
        },
        saved.passengerId,
      );
    } catch (e: any) {
      this.logger.warn(`Unable to publish booking.confirmed for ${saved.id}: ${e?.message ?? e}`);
    }

    this.queueRefresh();

    return res.status(HttpStatus.OK).json(saved);
  }
}
