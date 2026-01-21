import { Module, OnModuleInit, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBus } from './event-bus';
import { PaymentController } from './payment.controller';
import { MetricsController, MetricsMiddleware } from './metrics';
import { PaymentEvent, PaymentIdempotencyKey, PaymentIntent } from './entities';
import { PaymentService } from './payment.service';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';
const migrationsRun =
  process.env.MIGRATIONS_RUN !== undefined
    ? ['1', 'true', 'yes', 'on'].includes(process.env.MIGRATIONS_RUN.toLowerCase())
    : true;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [PaymentIntent, PaymentIdempotencyKey, PaymentEvent],
      synchronize: false,
      migrationsRun,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([PaymentIntent, PaymentIdempotencyKey, PaymentEvent]),
  ],
  controllers: [PaymentController, MetricsController],
  providers: [EventBus, PaymentService],
})
export class AppModule implements OnModuleInit {
  constructor(private bus: EventBus, private payments: PaymentService) {}
  configure(c: MiddlewareConsumer) {
    c.apply(MetricsMiddleware).forRoutes('*');
  }
  async onModuleInit() {
    await this.bus.subscribe('payment-group', 'payment.intent', async (evt) => {
      await this.payments.handlePaymentIntent(evt);
    });
  }
}
