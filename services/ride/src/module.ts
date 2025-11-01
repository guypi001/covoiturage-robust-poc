import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ride, Outbox, FleetVehicle, VehicleSchedule } from './entities';
import { RideController } from './ride.controller';
import { EventBus } from './event-bus';
import { AdminRideController } from './admin.controller';
import { FleetAdminController } from './fleet.controller';
import { InternalGuard } from './internal.guard';
import { MetricsController, MetricsMiddleware } from './metrics';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [Ride, Outbox, FleetVehicle, VehicleSchedule],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Ride, Outbox, FleetVehicle, VehicleSchedule]),
  ],
  controllers: [RideController, AdminRideController, FleetAdminController, MetricsController],
  providers: [EventBus, InternalGuard],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
