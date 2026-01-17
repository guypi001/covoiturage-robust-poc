import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';

const DEFAULT_EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
  private readonly expoUrl = process.env.EXPO_PUSH_URL || DEFAULT_EXPO_PUSH_URL;

  async registerToken(payload: {
    ownerId: string;
    token: string;
    platform?: string;
    deviceId?: string;
  }) {
    const key = `push:tokens:${payload.ownerId}`;
    await this.redis.sadd(key, payload.token);
    await this.redis.expire(key, 60 * 60 * 24 * 120);
    if (payload.deviceId || payload.platform) {
      const metaKey = `push:token:${payload.token}`;
      await this.redis.hset(metaKey, {
        ownerId: payload.ownerId,
        platform: payload.platform ?? '',
        deviceId: payload.deviceId ?? '',
        updatedAt: new Date().toISOString(),
      });
      await this.redis.expire(metaKey, 60 * 60 * 24 * 120);
    }
    return { ok: true };
  }

  async sendTest(ownerId: string, title?: string, body?: string) {
    const tokens = await this.redis.smembers(`push:tokens:${ownerId}`);
    if (!tokens.length) {
      return { ok: false, reason: 'no_tokens' };
    }
    const messages = tokens.map((token) => ({
      to: token,
      title: title || 'KariGo',
      body: body || 'Notification test',
      sound: 'default',
    }));
    const { data } = await axios.post(this.expoUrl, messages, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { ok: true, receipts: data };
  }
}
