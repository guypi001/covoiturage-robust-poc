import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Account, OtpToken, PasswordResetToken } from './entities';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

export default new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: [Account, OtpToken, PasswordResetToken],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
