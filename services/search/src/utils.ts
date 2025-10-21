import IORedis from 'ioredis';
import { EventBus } from './event-bus';

// Idempotence atomique via Lua (SET key '1' EX ttl NX)
export class Idempotency {
  private redis: IORedis;
  constructor(url = process.env.REDIS_URL || 'redis://redis:6379') {
    this.redis = new IORedis(url);
  }
  async firstTime(key: string, ttlSec = 86400): Promise<boolean> {
    const script = "return redis.call('SET', KEYS[1], '1', 'EX', ARGV[1], 'NX')";
    const res = await this.redis.eval(script, 1, `idem:${key}`, ttlSec);
    // Redis renvoie 'OK' si posé, nil (null) si la clé existait déjà
    return res === 'OK';
  }
}

// Retry + DLQ wrapper
export function withRetryAndDLQ(
  handler: (evt: any) => Promise<void>,
  bus: EventBus,
  topic: string,
  maxRetry = 3
) {
  return async (evt: any) => {
    let attempt = 0;
    while (attempt < maxRetry) {
      try {
        await handler(evt);
        return;
      } catch (e) {
        attempt++;
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
    await bus.publish(`${topic}.dlq`, { failed: evt, reason: 'max_retries' }, evt?.id || evt?.rideId);
  };
}
