// services/booking/src/module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities';
import { BookingController } from './booking.controller';
import { EventBus } from './event-bus';
import { AdminBookingController } from './admin.controller';
import { InternalGuard } from './internal.guard';
import { MetricsController, MetricsMiddleware } from './metrics';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage',
      entities: [Booking],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Booking]),
  ],
  controllers: [BookingController, AdminBookingController, MetricsController],
  providers: [EventBus, InternalGuard],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
