import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ride, Outbox } from './entities';
import { RideController } from './ride.controller';
import { EventBus } from './event-bus';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [Ride, Outbox],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Ride, Outbox]),
  ],
  controllers: [RideController],
  providers: [EventBus],
})
export class AppModule {}
