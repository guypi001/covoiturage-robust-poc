// services/search/src/module.ts
import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common';
import { SearchController } from './search.controller';
import { EventBus } from './event-bus';
import { MeiliService } from './meili.service';
import { MetricsController, MetricsMiddleware } from './metrics';
import { Idempotency, withRetryAndDLQ } from './utils';
import { GeoService } from './geo/geo';

@Module({
  controllers: [SearchController, MetricsController],
  providers: [EventBus, MeiliService, GeoService],
})
export class AppModule implements OnModuleInit {
  private idem = new Idempotency();
  constructor(private bus: EventBus, private meili: MeiliService) {}

  configure(c: MiddlewareConsumer) {
    c.apply(MetricsMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    // init Meili (index, settings)
    await this.meili.init();

    // Abonnement aux événements de publication de trajet
    await this.bus.subscribe(
      'search-group',
      'ride.published',
      withRetryAndDLQ(
        async (evt: any) => {
          const key = evt.rideId || evt.id;
          if (!(await this.idem.firstTime(`ride.pub:${key}`))) return;
          await this.meili.indexRide(evt);
        },
        this.bus,
        'ride.published',
      ),
    );

    await this.bus.subscribe(
      'search-group',
      'ride.updated',
      withRetryAndDLQ(
        async (evt: any) => {
          const key = evt.rideId || evt.id;
          if (!key) return;
          await this.meili.indexRide(evt);
        },
        this.bus,
        'ride.updated',
      ),
    );
  }
}
