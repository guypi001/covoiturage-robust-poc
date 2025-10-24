import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

function sanitizeBrokers(raw: string) {
  return raw
    .split(',')
    .map((b) => b.trim())
    .map((b) =>
      b.includes('127.0.0.1') || b.includes('localhost') ? 'redpanda:9092' : b,
    );
}

@Injectable()
export class EventBus implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer!: Producer;
  private consumers: Consumer[] = [];
  private connected = false;

  constructor() {
    const raw = process.env.KAFKA_BROKERS || 'redpanda:9092';
    const brokers = sanitizeBrokers(raw);
    this.kafka = new Kafka({ brokers, logLevel: logLevel.ERROR });
  }

  async onModuleInit() {
    await this.ensureProducer();
  }

  async onModuleDestroy() {
    await Promise.all(this.consumers.map((c) => c.disconnect().catch(() => undefined)));
    if (this.producer) await this.producer.disconnect().catch(() => undefined);
  }

  private async ensureProducer(retry = 3) {
    if (this.connected) return;
    this.producer = this.kafka.producer();
    while (retry-- > 0) {
      try {
        await this.producer.connect();
        this.connected = true;
        return;
      } catch (e: any) {
        console.error('[EventBus] producer connect failed, retrying:', e?.message || e);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  async publish(topic: string, message: any, key?: string) {
    try {
      if (!this.connected) await this.ensureProducer();
      if (!this.connected) throw new Error('producer not connected');
      await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(message) }] });
    } catch (e: any) {
      console.error('[EventBus] publish failed:', topic, e?.message || e);
    }
  }

  async subscribe(groupId: string, topic: string, handler: (payload: any) => Promise<void> | void) {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          await handler(JSON.parse(message.value.toString('utf-8')));
        } catch (err) {
          console.error('Event handler error for topic', topic, err);
        }
      },
    });
    this.consumers.push(consumer);
  }
}
