import { Body, Controller, Post } from '@nestjs/common'; import { EventBus } from './event-bus';
@Controller('payouts') export class PayoutsController {
  constructor(private bus:EventBus){} @Post() async request(@Body() body:{ driverId:string; amount:number }){
    await this.bus.publish('payout.requested', body, body.driverId); return { ok:true }; } }
