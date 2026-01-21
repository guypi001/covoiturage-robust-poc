import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { HealthController } from './health.controller';
import { MetricsController, MetricsMiddleware } from './metrics';
import { InternalController } from './internal.controller';
import { AdminAccountsController } from './admin.controller';
import { UploadsController } from './uploads.controller';
import { Account, CompanyDocument, OtpToken, PasswordResetToken, PhoneOtpToken, Report, SavedSearch } from './entities';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { OtpService } from './otp.service';
import { MailerService } from './mailer.service';
import { InternalGuard } from './internal.guard';
import { AdminGuard } from './admin.guard';
import { AdminToolsController } from './admin-tools.controller';
import { AdminRideService } from './admin-rides.service';
import { PhoneOtpService } from './phone-otp.service';
import { SmsService } from './sms.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';
import { CompanyController } from './company.controller';

const migrationsRun =
  process.env.MIGRATIONS_RUN !== undefined
    ? ['1', 'true', 'yes', 'on'].includes(process.env.MIGRATIONS_RUN.toLowerCase())
    : true;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage',
      entities: [Account, OtpToken, PasswordResetToken, PhoneOtpToken, Report, SavedSearch, CompanyDocument],
      synchronize: false,
      migrationsRun,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([Account, OtpToken, PasswordResetToken, PhoneOtpToken, Report, SavedSearch, CompanyDocument]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
    }),
  ],
  controllers: [
    AuthController,
    ProfileController,
    HealthController,
    MetricsController,
    InternalController,
    AdminAccountsController,
    AdminToolsController,
    UploadsController,
    ReportsController,
    SavedSearchesController,
    CompanyController,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    OtpService,
    PhoneOtpService,
    MailerService,
    SmsService,
    InternalGuard,
    AdminGuard,
    AdminRideService,
    ReportsService,
    SavedSearchesService,
  ],
})
export class AppModule {
  configure(c: MiddlewareConsumer) {
    c.apply(MetricsMiddleware).forRoutes('*');
  }
}
