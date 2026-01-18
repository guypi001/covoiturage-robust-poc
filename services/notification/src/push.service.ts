import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';

const DEFAULT_EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushCategory = 'MESSAGE' | 'PAYMENT' | 'RIDE_IMMINENT' | 'TEST';

type PushPayload = {
  title: string;
  body: string;
  category: PushCategory;
  data?: Record<string, any>;
};

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
    return this.sendToOwner(ownerId, {
      title: title || 'KariGo',
      body: body || 'Notification test',
      category: 'TEST',
    });
  }

  async sendToOwner(ownerId: string, payload: PushPayload) {
    const tokens = await this.redis.smembers(`push:tokens:${ownerId}`);
    if (!tokens.length) {
      return { ok: false, reason: 'no_tokens' };
    }
    const messages = tokens.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      sound: 'default',
      data: {
        category: payload.category,
        ...payload.data,
      },
    }));
    const { data } = await axios.post(this.expoUrl, messages, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { ok: true, receipts: data };
  }

  async sendMessagePush(ownerId: string, message: { conversationId?: string; senderId?: string; preview?: string }) {
    return this.sendToOwner(ownerId, {
      title: 'Nouveau message',
      body: message.preview || 'Nouveau message recu',
      category: 'MESSAGE',
      data: {
        conversationId: message.conversationId,
        senderId: message.senderId,
      },
    });
  }

  async sendPaymentPush(ownerId: string, payment: { bookingId?: string; amount?: number; rideId?: string }) {
    const formattedAmount =
      typeof payment.amount === 'number' ? `${payment.amount.toFixed(2)} EUR` : 'paiement confirme';
    return this.sendToOwner(ownerId, {
      title: 'Paiement confirme',
      body: formattedAmount,
      category: 'PAYMENT',
      data: {
        bookingId: payment.bookingId,
        rideId: payment.rideId,
      },
    });
  }

  async sendRideImminentPush(
    ownerId: string,
    ride: { rideId?: string; originCity?: string | null; destinationCity?: string | null },
  ) {
    const routeLabel = [ride.originCity, ride.destinationCity].filter(Boolean).join(' → ');
    return this.sendToOwner(ownerId, {
      title: 'Trajet imminent',
      body: routeLabel ? `Depart dans 15 min: ${routeLabel}` : 'Depart dans 15 min',
      category: 'RIDE_IMMINENT',
      data: {
        rideId: ride.rideId,
      },
    });
  }
}
