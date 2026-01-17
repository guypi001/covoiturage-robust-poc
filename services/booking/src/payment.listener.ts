import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities';
import { EventBus } from './event-bus';

type PaymentCapturedEvent = {
  bookingId: string;
  amount?: number;
  provider?: string;
  paymentMethodType?: string;
  paymentMethodId?: string;
};

const CARD_PROVIDERS = new Set(['VISA', 'MASTERCARD', 'CARTE']);
const MOBILE_PROVIDERS = new Set(['MTN Money', 'Orange Money', 'Moov Money']);
const METHOD_TYPES = new Set(['CARD', 'MOBILE_MONEY', 'CASH']);

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
    if (evt.paymentMethodType) booking.paymentMethod = evt.paymentMethodType;
    if (evt.provider) booking.paymentProvider = evt.provider;
    if (evt.paymentMethodId) booking.paymentMethodId = evt.paymentMethodId;
    await this.bookings.save(booking);
  }
}
