import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { CapturePaymentDto, RefundPaymentDto, WebhookEventDto } from './dto';
import { PaymentService } from './payment.service';
import type { Response } from 'express';

const CARD_PROVIDERS = new Set(['VISA', 'MASTERCARD', 'CARTE']);
const MOBILE_PROVIDERS = new Set(['MTN Money', 'Orange Money', 'Moov Money']);
const METHOD_TYPES = new Set(['CARD', 'MOBILE_MONEY', 'CASH']);

@Controller()
export class PaymentController {
  constructor(private payments: PaymentService) {}

  @Post('mock-capture')
  async mockCapture(@Body() body: CapturePaymentDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.capture(body, idempotencyKey);
  }

  @Post('payments/capture')
  async capture(
    @Body() body: CapturePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (body.paymentMethodType && !METHOD_TYPES.has(body.paymentMethodType)) {
      await this.payments.markFailed(body.bookingId, 'invalid_payment_method_type');
      throw new BadRequestException('invalid_payment_method_type');
    }
    if (body.paymentProvider) {
      if (body.paymentMethodType === 'CARD' && !CARD_PROVIDERS.has(body.paymentProvider)) {
        await this.payments.markFailed(body.bookingId, 'invalid_payment_provider');
        throw new BadRequestException('invalid_payment_provider');
      }
      if (body.paymentMethodType === 'MOBILE_MONEY' && !MOBILE_PROVIDERS.has(body.paymentProvider)) {
        await this.payments.markFailed(body.bookingId, 'invalid_payment_provider');
        throw new BadRequestException('invalid_payment_provider');
      }
      if (body.paymentMethodType === 'CASH' && body.paymentProvider !== 'CASH') {
        await this.payments.markFailed(body.bookingId, 'invalid_payment_provider');
        throw new BadRequestException('invalid_payment_provider');
      }
    }
    try {
      return await this.payments.capture(idempotencyKey, body);
    } catch (err: any) {
      await this.payments.markFailed(body.bookingId, err?.message || 'payment_failed');
      throw err;
    }
  }

  @Post('payments/refund')
  async refund(
    @Body() body: RefundPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.refund(idempotencyKey, body);
  }

  @Post('webhooks/mock')
  async webhook(@Body() body: WebhookEventDto) {
    return this.payments.handleWebhook(body);
  }

  @Get('companies/:companyId/invoices')
  async companyInvoice(@Param('companyId') companyId: string, @Query('month') month?: string) {
    return this.payments.getCompanyInvoice(companyId, month);
  }

  @Get('companies/:companyId/invoices/export')
  async exportInvoice(
    @Param('companyId') companyId: string,
    @Query('month') month: string | undefined,
    @Res() res: Response,
  ) {
    const invoice = await this.payments.getCompanyInvoice(companyId, month);
    const csv = this.payments.getInvoiceCsv(invoice);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=\"invoice-${invoice.month}.csv\"`);
    return res.send(csv);
  }
}
