import { Body, Controller, Get, Param, Post, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; import { Repository } from 'typeorm'; import { Wallet, Hold } from './entities';
@Controller() export class WalletController {
  constructor(@InjectRepository(Wallet) private wallets:Repository<Wallet>, @InjectRepository(Hold) private holds:Repository<Hold>) {}
  @Post('wallets') async createWallet(@Body() dto:{ ownerId:string }){ const existing=await this.wallets.findOne({ where:{ ownerId:dto.ownerId } }); if(existing) return existing; return await this.wallets.save(this.wallets.create({ ownerId:dto.ownerId })); }
  @Get('wallets/:ownerId') async getWallet(@Param('ownerId') ownerId:string){ const w=await this.wallets.findOne({ where:{ ownerId } }); return w || { error:'not_found' }; }
  @Post('holds') async createHold(@Body() dto:{ ownerId:string; referenceId:string; amount:number }){
    if(!dto.ownerId || !dto.referenceId || !dto.amount) throw new BadRequestException('missing fields');
    let wallet = await this.wallets.findOne({ where:{ ownerId: dto.ownerId } }); if(!wallet) wallet = await this.wallets.save(this.wallets.create({ ownerId: dto.ownerId }));
    const h = await this.holds.save(this.holds.create({ ownerId: dto.ownerId, referenceId: dto.referenceId, amount: dto.amount, status:'HELD' })); return h; }
  @Get('holds/:id') async getHold(@Param('id') id:string){ const h=await this.holds.findOne({ where:{ id } }); return h || { error:'not_found' }; }
}
