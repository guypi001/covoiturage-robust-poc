import { Module, MiddlewareConsumer } from '@nestjs/common'; import { FlagsController } from './flags.controller';
import { MetricsController, MetricsMiddleware } from './metrics';
@Module({ controllers:[FlagsController, MetricsController] })
export class AppModule { configure(c:MiddlewareConsumer){ c.apply(MetricsMiddleware).forRoutes('*'); } }
