import { Module, MiddlewareConsumer } from '@nestjs/common'; import { EventBus } from './event-bus';
import { PayoutsController } from './payouts.controller'; import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers:[PayoutsController, MetricsController], providers:[EventBus] })
export class AppModule { configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); } }
