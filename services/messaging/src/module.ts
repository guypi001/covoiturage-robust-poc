import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation, Message, MessageNotification } from './entities';
import { MessagesController } from './messages.controller';
import { UploadsController } from './uploads.controller';
import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
import { HealthController } from './health.controller';

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
      entities: [Conversation, Message, MessageNotification],
      synchronize: false,
      migrationsRun,
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
    }),
    TypeOrmModule.forFeature([Conversation, Message, MessageNotification]),
  ],
  controllers: [MessagesController, UploadsController, HealthController, MetricsController],
  providers: [EventBus],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
