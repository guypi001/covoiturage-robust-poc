import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { EventBus } from './event-bus';

const CARD_PROVIDERS = new Set(['VISA', 'MASTERCARD', 'CARTE']);
const MOBILE_PROVIDERS = new Set(['MTN Money', 'Orange Money', 'Moov Money']);
const METHOD_TYPES = new Set(['CARD', 'MOBILE_MONEY', 'CASH']);

@Controller()
export class PaymentController {
  constructor(private bus: EventBus) {}

  @Post('mock-capture')
  async mockCapture(
    @Body()
    body: {
      bookingId: string;
      amount: number;
      holdId?: string;
      paymentMethodType?: string;
      paymentMethodId?: string;
      paymentProvider?: string;
    },
  ) {
    if (body.paymentMethodType && !METHOD_TYPES.has(body.paymentMethodType)) {
      throw new BadRequestException('invalid_payment_method_type');
    }
    if (body.paymentProvider) {
      if (body.paymentMethodType === 'CARD' && !CARD_PROVIDERS.has(body.paymentProvider)) {
        throw new BadRequestException('invalid_payment_provider');
      }
      if (body.paymentMethodType === 'MOBILE_MONEY' && !MOBILE_PROVIDERS.has(body.paymentProvider)) {
        throw new BadRequestException('invalid_payment_provider');
      }
      if (body.paymentMethodType === 'CASH' && body.paymentProvider !== 'CASH') {
        throw new BadRequestException('invalid_payment_provider');
      }
    }
    await this.bus.publish(
      'payment.captured',
      {
        bookingId: body.bookingId,
        amount: body.amount,
        provider: body.paymentProvider || 'MOCK',
        holdId: body.holdId,
        paymentMethodType: body.paymentMethodType,
        paymentMethodId: body.paymentMethodId,
      },
      body.bookingId,
    );
    return { ok: true };
  }
}
