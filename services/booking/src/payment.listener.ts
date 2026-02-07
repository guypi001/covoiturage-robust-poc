import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, PaymentMethodType } from './entities';
import { EventBus } from './event-bus';
import { http } from './utils';

type PaymentCapturedEvent = {
  bookingId: string;
  amount?: number;
  provider?: string;
  paymentMethodType?: PaymentMethodType;
  paymentMethodId?: string;
};

type PaymentFailedEvent = {
  bookingId: string;
  reason?: string;
};

type PaymentRefundedEvent = {
  bookingId: string;
  amount?: number;
};

const CARD_PROVIDERS = new Set(['VISA', 'MASTERCARD', 'CARTE']);
const MOBILE_PROVIDERS = new Set(['MTN Money', 'Orange Money', 'Moov Money']);
const METHOD_TYPES = new Set<PaymentMethodType>(['CARD', 'MOBILE_MONEY', 'CASH']);
const RIDE_URL = process.env.RIDE_URL || 'http://ride:3000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';

@Injectable()
export class PaymentListener implements OnModuleInit {
  private readonly logger = new Logger(PaymentListener.name);

  constructor(
    private readonly bus: EventBus,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  async onModuleInit() {
    await this.bus.subscribe('booking-group', 'payment.captured', async (evt) => {
      await this.handlePaymentCaptured(evt as PaymentCapturedEvent);
    });
    await this.bus.subscribe('booking-group', 'payment.failed', async (evt) => {
      await this.handlePaymentFailed(evt as PaymentFailedEvent);
    });
    await this.bus.subscribe('booking-group', 'payment.refunded', async (evt) => {
      await this.handlePaymentRefunded(evt as PaymentRefundedEvent);
    });
  }

  private internalHeaders() {
    return {
      'x-internal-key': INTERNAL_KEY,
      'x-internal-api-key': INTERNAL_KEY,
    };
  }

  private async unlockRideSeats(rideId: string, seats: number) {
    try {
      await http({
        method: 'POST',
        url: `${RIDE_URL}/rides/${rideId}/unlock`,
        data: { seats },
        headers: this.internalHeaders(),
      });
    } catch (err) {
      this.logger.error(
        `payment.failed unlock seats failed for ride ${rideId}: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  private async handlePaymentCaptured(evt: PaymentCapturedEvent) {
    if (!evt?.bookingId) return;
    const booking = await this.bookings.findOne({ where: { id: evt.bookingId } });
    if (!booking) {
      this.logger.warn(`payment.captured ignored: booking ${evt.bookingId} not found`);
      return;
    }
    if (evt.paymentMethodType && !METHOD_TYPES.has(evt.paymentMethodType)) {
      this.logger.warn(`payment.captured invalid paymentMethodType ${evt.paymentMethodType}`);
      return;
    }
    if (evt.provider) {
      if (evt.paymentMethodType === 'CARD' && !CARD_PROVIDERS.has(evt.provider)) {
        this.logger.warn(`payment.captured invalid card provider ${evt.provider}`);
        return;
      }
      if (evt.paymentMethodType === 'MOBILE_MONEY' && !MOBILE_PROVIDERS.has(evt.provider)) {
        this.logger.warn(`payment.captured invalid mobile provider ${evt.provider}`);
        return;
      }
      if (evt.paymentMethodType === 'CASH' && evt.provider !== 'CASH') {
        this.logger.warn(`payment.captured invalid cash provider ${evt.provider}`);
        return;
      }
    }
    booking.status = 'PAID';
    booking.paymentStatus = 'CONFIRMED';
    booking.paymentError = null;
    if (evt.paymentMethodType) {
      booking.paymentMethod = evt.paymentMethodType as PaymentMethodType;
    }
    if (evt.provider) booking.paymentProvider = evt.provider;
    if (evt.paymentMethodId) booking.paymentMethodId = evt.paymentMethodId;
    await this.bookings.save(booking);
  }

  private async handlePaymentFailed(evt: PaymentFailedEvent) {
    if (!evt?.bookingId) return;
    const booking = await this.bookings.findOne({ where: { id: evt.bookingId } });
    if (!booking) return;
    if (booking.status !== 'CANCELLED') {
      booking.status = 'CANCELLED';
      await this.unlockRideSeats(booking.rideId, booking.seats);
    }
    booking.paymentStatus = 'FAILED';
    booking.paymentError = evt.reason?.slice(0, 160) || 'payment_failed';
    await this.bookings.save(booking);
  }

  private async handlePaymentRefunded(evt: PaymentRefundedEvent) {
    if (!evt?.bookingId) return;
    const booking = await this.bookings.findOne({ where: { id: evt.bookingId } });
    if (!booking) return;
    const refundAmount = evt.amount ?? 0;
    booking.paymentStatus = 'REFUNDED';
    booking.paymentRefundedAmount = (booking.paymentRefundedAmount || 0) + refundAmount;
    await this.bookings.save(booking);
  }
}
