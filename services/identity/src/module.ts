import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { HealthController } from './health.controller';
import { MetricsController, MetricsMiddleware } from './metrics';
import { InternalController } from './internal.controller';
import { Account, OtpToken } from './entities';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { OtpService } from './otp.service';
import { MailerService } from './mailer.service';
import { InternalGuard } from './internal.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage',
      entities: [Account, OtpToken],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Account, OtpToken]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
    }),
  ],
  controllers: [AuthController, ProfileController, HealthController, MetricsController, InternalController],
  providers: [AuthService, JwtAuthGuard, OtpService, MailerService, InternalGuard],
})
export class AppModule {
  configure(c: MiddlewareConsumer) {
    c.apply(MetricsMiddleware).forRoutes('*');
  }
}
