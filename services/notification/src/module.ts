import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common'; import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers:[MetricsController], providers:[EventBus] })
export class AppModule implements OnModuleInit { constructor(private bus:EventBus){} configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); }
  async onModuleInit(){ await this.bus.subscribe('notif-group','payment.captured', async (evt)=>{ console.log('[NOTIF] payment captured', evt); });
    await this.bus.subscribe('notif-group','ride.published', async (evt)=>{ console.log('[NOTIF] new ride', (evt as any).originCity, '→', (evt as any).destinationCity); }); } }
