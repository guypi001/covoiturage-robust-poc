// services/ride/src/module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ride } from './entities';          // adapte si ton entité est ailleurs
import { RideController } from './ride.controller';
import { EventBus } from './event-bus';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [Ride],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Ride]),
  ],
  controllers: [RideController],
  providers: [EventBus],
})
export class AppModule {}
