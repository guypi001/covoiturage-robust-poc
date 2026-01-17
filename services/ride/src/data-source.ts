import { DataSource } from 'typeorm';
import { FleetVehicle, Outbox, Ride, VehicleSchedule } from './entities';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: [Ride, Outbox, FleetVehicle, VehicleSchedule],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});

export default AppDataSource;
