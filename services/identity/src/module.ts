import { Module, MiddlewareConsumer } from '@nestjs/common';
import { HealthController } from './health.controller'; import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers: [HealthController, MetricsController] })
export class AppModule { configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); } }
