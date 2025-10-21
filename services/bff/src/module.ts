import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers: [ProxyController, MetricsController], providers: [EventBus] })
export class AppModule { configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); } }
