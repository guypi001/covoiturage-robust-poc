// services/booking/src/module.ts
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities';
import { BookingController } from './booking.controller';
import { EventBus } from './event-bus';

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
  controllers: [BookingController],
  providers: [EventBus],
})
export class AppModule {
  configure(_c: MiddlewareConsumer) {
    // Ne pas brancher de MetricsMiddleware ici
  }
}
