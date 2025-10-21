import { Body, Controller, Post } from '@nestjs/common'; import { EventBus } from './event-bus';
@Controller() export class PaymentController {
  constructor(private bus:EventBus){} @Post('mock-capture') async mockCapture(@Body() body:{ bookingId:string, amount:number, holdId?:string }){
    await this.bus.publish('payment.captured', { bookingId: body.bookingId, amount: body.amount, provider:'MOCK', holdId: body.holdId }, body.bookingId);
    return { ok:true }; } }
