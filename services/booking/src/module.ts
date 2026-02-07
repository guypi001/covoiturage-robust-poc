// services/booking/src/module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, Rating } from './entities';
import { BookingController } from './booking.controller';
import { EventBus } from './event-bus';
import { AdminBookingController } from './admin.controller';
import { InternalGuard } from './internal.guard';
import { PaymentListener } from './payment.listener';
import { MetricsController, MetricsMiddleware } from './metrics';
import { RatingsController } from './ratings.controller';

const migrationsRun =
  process.env.MIGRATIONS_RUN !== undefined
    ? ['1', 'true', 'yes', 'on'].includes(process.env.MIGRATIONS_RUN.toLowerCase())
    : true;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage',
      entities: [Booking, Rating],
      synchronize: false,
      migrationsRun,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([Booking, Rating]),
  ],
  controllers: [BookingController, AdminBookingController, MetricsController, RatingsController],
  providers: [EventBus, InternalGuard, PaymentListener],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
