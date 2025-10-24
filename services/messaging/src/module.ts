import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation, Message, MessageNotification } from './entities';
import { MessagesController } from './messages.controller';
import { EventBus } from './event-bus';
import { MetricsController, MetricsMiddleware } from './metrics';
import { HealthController } from './health.controller';

const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: dbUrl,
      entities: [Conversation, Message, MessageNotification],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Conversation, Message, MessageNotification]),
  ],
  controllers: [MessagesController, HealthController, MetricsController],
  providers: [EventBus],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
