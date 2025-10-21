import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common'; import { SearchController } from './search.controller';
import { EventBus } from './event-bus'; import { MeiliService } from './meili.service'; import { MetricsController, MetricsMiddleware } from './metrics';
import { Idempotency } from './utils'; import { withRetryAndDLQ } from './utils';
@Module({ controllers:[SearchController, MetricsController], providers:[EventBus, MeiliService] })
export class AppModule implements OnModuleInit {
  private idem = new Idempotency(); constructor(private bus:EventBus, private meili:MeiliService){} configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); }
  async onModuleInit(){ await this.meili.init(); await this.bus.subscribe('search-group','ride.published',
      withRetryAndDLQ(async (evt:any)=>{ const key = evt.rideId || evt.id; if(!(await this.idem.firstTime(`ride.pub:${key}`))) return; await this.meili.indexRide(evt); }, this.bus, 'ride.published')); }
}
