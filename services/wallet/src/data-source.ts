import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Wallet, Hold, PaymentMethod } from './entities';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

export default new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: [Wallet, Hold, PaymentMethod],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
