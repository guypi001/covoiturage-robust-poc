import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import crypto from 'crypto';
import { PaymentEvent, PaymentIdempotencyKey, PaymentIntent } from './entities';
import { EventBus } from './event-bus';
import { CapturePaymentDto, RefundPaymentDto, WebhookEventDto } from './dto';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentIntent) private intents: Repository<PaymentIntent>,
    @InjectRepository(PaymentIdempotencyKey) private idempotency: Repository<PaymentIdempotencyKey>,
    @InjectRepository(PaymentEvent) private events: Repository<PaymentEvent>,
    private bus: EventBus,
  ) {}

  async handlePaymentIntent(evt: { bookingId: string; amount: number; currency?: string; holdId?: string }) {
    if (!evt?.bookingId) return;
    const existing = await this.intents.findOne({ where: { bookingId: evt.bookingId } });
    if (existing) return existing;
    const intent = this.intents.create({
      bookingId: evt.bookingId,
      amount: evt.amount,
      currency: evt.currency || 'XOF',
      status: 'PENDING',
    });
    return this.intents.save(intent);
  }

  private hashRequest(payload: any) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async checkIdempotency(key: string | undefined, payload: any) {
    if (!key) return null;
    const requestHash = this.hashRequest(payload);
    const existing = await this.idempotency.findOne({ where: { idempotencyKey: key } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new BadRequestException('idempotency_key_conflict');
      }
      return existing.response ?? { ok: true, cached: true };
    }
    await this.idempotency.save(
      this.idempotency.create({
        idempotencyKey: key,
        requestHash,
        status: 'PENDING',
      }),
    );
    return null;
  }

  private async saveIdempotency(key: string | undefined, payload: any, response: any, status: string) {
    if (!key) return;
    const requestHash = this.hashRequest(payload);
    await this.idempotency.save(
      this.idempotency.create({
        idempotencyKey: key,
        requestHash,
        response,
        status,
      }),
    );
  }

  private async ensureVelocitySafe(payerId?: string, bookingId?: string) {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
    if (payerId) {
      const count = await this.intents.count({
        where: { payerId, createdAt: MoreThan(since) },
      });
      if (count >= MAX_ATTEMPTS) {
        throw new BadRequestException('payment_velocity_exceeded');
      }
      return;
    }
    if (bookingId) {
      const count = await this.intents.count({
        where: { bookingId, createdAt: MoreThan(since) },
      });
      if (count >= MAX_ATTEMPTS) {
        throw new BadRequestException('payment_velocity_exceeded');
      }
    }
  }

  private async logEvent(type: string, payload: Record<string, any>) {
    const eventId = payload?.eventId || `${type}_${payload?.bookingId || 'unknown'}_${Date.now()}`;
    await this.events.save(
      this.events.create({
        eventId,
        type,
        payload,
        processedAt: new Date(),
      }),
    );
  }

  async getCompanyInvoice(companyId: string, month?: string) {
    const { start, end } = this.resolveMonthRange(month);
    const qb = this.intents
      .createQueryBuilder('intent')
      .where('intent.payerId = :companyId', { companyId })
      .andWhere('intent.createdAt >= :start', { start })
      .andWhere('intent.createdAt < :end', { end });

    const intents = await qb.orderBy('intent.createdAt', 'DESC').getMany();
    const totalAmount = intents.reduce((acc, item) => acc + (item.amount ?? 0), 0);
    const totalRefunded = intents.reduce((acc, item) => acc + (item.refundedAmount ?? 0), 0);
    const byStatus = intents.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      companyId,
      month: start.toISOString().slice(0, 7),
      totalAmount,
      totalRefunded,
      byStatus,
      items: intents,
    };
  }

  getInvoiceCsv(invoice: Awaited<ReturnType<PaymentService['getCompanyInvoice']>>) {
    const headers = [
      'bookingId',
      'amount',
      'currency',
      'status',
      'paymentMethodType',
      'paymentProvider',
      'createdAt',
    ];
    const rows = invoice.items.map((item) =>
      [
        item.bookingId,
        item.amount,
        item.currency,
        item.status,
        item.paymentMethodType ?? '',
        item.paymentProvider ?? '',
        item.createdAt.toISOString(),
      ].join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private resolveMonthRange(month?: string) {
    if (!month) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { start, end };
    }
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const mon = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) {
      throw new BadRequestException('invalid_month');
    }
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1));
    return { start, end };
  }

  async capture(idempotencyKey: string | undefined, payload: CapturePaymentDto) {
    const cached = await this.checkIdempotency(idempotencyKey, payload);
    if (cached) return cached;

    await this.ensureVelocitySafe(payload.payerId, payload.bookingId);

    let intent = await this.intents.findOne({ where: { bookingId: payload.bookingId } });
    if (!intent) {
      intent = await this.intents.save(
        this.intents.create({
          bookingId: payload.bookingId,
          payerId: payload.payerId ?? null,
          amount: payload.amount,
          currency: 'XOF',
          status: 'PENDING',
        }),
      );
    }

    if (intent.status === 'CONFIRMED') {
      const response = { ok: true, status: intent.status, intentId: intent.id };
      await this.saveIdempotency(idempotencyKey, payload, response, 'CACHED');
      return response;
    }

    intent.status = 'CONFIRMED';
    intent.paymentMethodType = payload.paymentMethodType ?? null;
    intent.paymentMethodId = payload.paymentMethodId ?? null;
    intent.paymentProvider = payload.paymentProvider ?? null;
    intent.idempotencyKey = idempotencyKey ?? null;
    intent.capturedAt = new Date();
    intent.failureReason = null;
    await this.intents.save(intent);

    await this.bus.publish(
      'payment.captured',
      {
        bookingId: payload.bookingId,
        amount: payload.amount,
        provider: payload.paymentProvider || 'MOCK',
        paymentMethodType: payload.paymentMethodType,
        paymentMethodId: payload.paymentMethodId,
        payerId: payload.payerId,
      },
      payload.bookingId,
    );
    await this.logEvent('payment.captured', {
      bookingId: payload.bookingId,
      amount: payload.amount,
      provider: payload.paymentProvider || 'MOCK',
      paymentMethodType: payload.paymentMethodType,
      paymentMethodId: payload.paymentMethodId,
      payerId: payload.payerId,
    });

    const response = { ok: true, status: intent.status, intentId: intent.id };
    await this.saveIdempotency(idempotencyKey, payload, response, 'SUCCESS');
    return response;
  }

  async refund(idempotencyKey: string | undefined, payload: RefundPaymentDto) {
    const cached = await this.checkIdempotency(idempotencyKey, payload);
    if (cached) return cached;

    const intent = await this.intents.findOne({ where: { bookingId: payload.bookingId } });
    if (!intent) {
      throw new BadRequestException('payment_intent_not_found');
    }

    const remaining = intent.amount - (intent.refundedAmount || 0);
    const refundAmount = Math.min(payload.amount, remaining);
    if (refundAmount <= 0) {
      throw new BadRequestException('refund_amount_exceeded');
    }

    intent.refundedAmount = (intent.refundedAmount || 0) + refundAmount;
    intent.refundedAt = new Date();
    if (intent.refundedAmount >= intent.amount) {
      intent.status = 'REFUNDED';
    }
    await this.intents.save(intent);

    await this.bus.publish(
      'payment.refunded',
      {
        bookingId: payload.bookingId,
        amount: refundAmount,
        payerId: payload.payerId,
      },
      payload.bookingId,
    );
    await this.logEvent('payment.refunded', {
      bookingId: payload.bookingId,
      amount: refundAmount,
      payerId: payload.payerId,
    });

    const response = {
      ok: true,
      status: intent.status,
      refundedAmount: intent.refundedAmount,
    };
    await this.saveIdempotency(idempotencyKey, payload, response, 'SUCCESS');
    return response;
  }

  async markFailed(bookingId: string | undefined, reason: string) {
    if (!bookingId) return;
    const intent = await this.intents.findOne({ where: { bookingId } });
    if (intent) {
      intent.status = 'FAILED';
      intent.failureReason = reason.slice(0, 128);
      await this.intents.save(intent);
    }
    await this.bus.publish(
      'payment.failed',
      {
        bookingId,
        reason,
      },
      bookingId,
    );
    await this.logEvent('payment.failed', { bookingId, reason });
  }

  async handleWebhook(payload: WebhookEventDto) {
    const existing = await this.events.findOne({ where: { eventId: payload.eventId } });
    if (existing) return { ok: true, duplicate: true };

    const event = await this.events.save(
      this.events.create({
        eventId: payload.eventId,
        type: payload.type,
        payload: payload.payload || {},
        processedAt: new Date(),
      }),
    );

    if (payload.type === 'payment.captured') {
      await this.bus.publish('payment.captured', payload.payload, payload.payload?.bookingId);
    }
    if (payload.type === 'payment.failed') {
      await this.bus.publish('payment.failed', payload.payload, payload.payload?.bookingId);
    }
    if (payload.type === 'payment.refunded') {
      await this.bus.publish('payment.refunded', payload.payload, payload.payload?.bookingId);
    }

    return { ok: true, eventId: event.id };
  }
}
