import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, Hold, PaymentMethod } from './entities';

@Controller()
export class WalletController {
  constructor(
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    @InjectRepository(Hold) private holds: Repository<Hold>,
    @InjectRepository(PaymentMethod) private paymentMethods: Repository<PaymentMethod>,
  ) {}

  @Post('wallets')
  async createWallet(@Body() dto: { ownerId: string }) {
    const existing = await this.wallets.findOne({ where: { ownerId: dto.ownerId } });
    if (existing) return existing;
    if (!dto.ownerId) throw new BadRequestException('owner_required');
    return await this.wallets.save(this.wallets.create({ ownerId: dto.ownerId }));
  }

  @Get('wallets/:ownerId')
  async getWallet(@Param('ownerId') ownerId: string) {
    const wallet = await this.wallets.findOne({ where: { ownerId } });
    return wallet || { error: 'not_found' };
  }

  @Post('holds')
  async createHold(@Body() dto: { ownerId: string; referenceId: string; amount: number }) {
    if (!dto.ownerId || !dto.referenceId || !dto.amount) throw new BadRequestException('missing_fields');
    let wallet = await this.wallets.findOne({ where: { ownerId: dto.ownerId } });
    if (!wallet) wallet = await this.wallets.save(this.wallets.create({ ownerId: dto.ownerId }));
    const hold = this.holds.create({
      ownerId: dto.ownerId,
      referenceId: dto.referenceId,
      amount: dto.amount,
      status: 'HELD',
    });
    return await this.holds.save(hold);
  }

  @Get('holds/:id')
  async getHold(@Param('id') id: string) {
    const hold = await this.holds.findOne({ where: { id } });
    return hold || { error: 'not_found' };
  }

  @Get('payment-methods')
  async listPaymentMethods(@Query('ownerId') ownerId?: string) {
    if (!ownerId) throw new BadRequestException('owner_required');
    const methods = await this.paymentMethods.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
    return methods;
  }

  @Post('payment-methods')
  async addPaymentMethod(
    @Body()
    body: {
      ownerId: string;
      type: 'CARD' | 'MOBILE_MONEY' | 'CASH';
      label?: string;
      provider?: string;
      last4?: string;
      expiresAt?: string;
      phoneNumber?: string;
    },
  ) {
    if (!body?.ownerId) throw new BadRequestException('owner_required');
    if (!body?.type) throw new BadRequestException('type_required');
    if (body.type === 'CARD' && !body.last4) throw new BadRequestException('card_last4_required');
    if (body.type === 'MOBILE_MONEY' && !body.phoneNumber) {
      throw new BadRequestException('phone_required');
    }

    const method = this.paymentMethods.create({
      ownerId: body.ownerId,
      type: body.type,
      label: body.label?.trim() || null,
      provider: body.provider?.trim() || null,
      last4: body.last4?.slice(-4) ?? null,
      expiresAt: body.expiresAt?.trim() || null,
      phoneNumber: body.phoneNumber?.trim() || null,
    });
    return await this.paymentMethods.save(method);
  }

  @Delete('payment-methods/:id')
  async removePaymentMethod(@Param('id') id: string, @Query('ownerId') ownerId: string) {
    if (!ownerId) throw new BadRequestException('owner_required');
    const method = await this.paymentMethods.findOne({ where: { id, ownerId } });
    if (!method) {
      return { ok: true };
    }
    await this.paymentMethods.delete(method.id);
    return { ok: true };
  }
}
