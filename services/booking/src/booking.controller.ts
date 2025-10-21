// services/booking/src/booking.controller.ts
import { Body, Controller, Get, Param, Post, Res, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities';
import { CreateBookingDto } from './dto';
import { http } from './utils';
import { EventBus } from './event-bus';
import { Response } from 'express';

// ⚠️ En réseau Docker, "ride" écoute sur 3000 (pas 3002).
const RIDE_URL   = process.env.RIDE_URL   || 'http://ride:3000';
const WALLET_URL = process.env.WALLET_URL || 'http://wallet:3000';

@Controller('bookings')
export class BookingController {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly bus: EventBus,
  ) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    const b = await this.bookings.findOne({ where: { id } });
    return b || { error: 'not_found' };
  }

  @Post()
  async create(@Body() dto: CreateBookingDto, @Res() res: Response) {
    // 1) lock des sièges côté ride
    try {
      await http({ method: 'POST', url: `${RIDE_URL}/rides/${dto.rideId}/lock`, data: { seats: dto.seats } });
    } catch (e: any) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Seat lock failed', detail: e?.message });
    }

    // 2) calcul du montant
    let amount = 0;
    try {
      const ride = (await http({ method: 'GET', url: `${RIDE_URL}/rides/${dto.rideId}` })).data;
      amount = (ride?.pricePerSeat || 0) * dto.seats;
    } catch {}

    // 3) création réservation
    const booking = this.bookings.create({ ...dto, amount, status: 'CONFIRMED' });
    const saved = await this.bookings.save(booking);

    // 4) création d’un hold côté wallet
    try {
      const hold = (await http({
        method: 'POST',
        url: `${WALLET_URL}/holds`,
        data: { ownerId: dto.passengerId, referenceId: saved.id, amount },
      })).data;

      saved.holdId = hold.id;              // ✅ propriété camelCase
      await this.bookings.save(saved);
    } catch {}

    // 5) émission de l’intention de paiement
    await this.bus.publish(
      'payment.intent',
      { bookingId: saved.id, amount, currency: 'XOF', holdId: saved.holdId }, // ✅ holdId
      saved.id,
    );

    return res.status(HttpStatus.OK).json(saved);
  }
}
