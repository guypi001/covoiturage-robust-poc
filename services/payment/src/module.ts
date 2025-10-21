import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common';
import { EventBus } from './event-bus'; import { PaymentController } from './payment.controller'; import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers:[PaymentController, MetricsController], providers:[EventBus] })
export class AppModule implements OnModuleInit { constructor(private bus:EventBus){} configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); }
  async onModuleInit(){ await this.bus.subscribe('payment-group','payment.intent', async (evt)=>{ console.log('[payment] intent', evt); }); } }
