// services/booking/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import * as client from 'prom-client';
import { Request, Response } from 'express';

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return null;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function applySecurityHeaders(app: any) {
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
}

function applyRateLimit(app: any) {
  const express = app.getHttpAdapter().getInstance();
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200);
  const hits = new Map<string, { count: number; resetAt: number }>();
  express.use((req: Request, res: Response, next: () => void) => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const state = hits.get(ip);
    if (!state || state.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (state.count >= maxRequests) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }
    state.count += 1;
    next();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // CORS (IHM)
  const allowedOrigins = parseCorsOrigins();
  const corsOptions: CorsOptions = {
    origin: allowedOrigins ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.enableCors(corsOptions);
  applySecurityHeaders(app);
  applyRateLimit(app);

  // ----- Prometheus: registre DÉDIÉ (évite le doublon) -----
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const express = app.getHttpAdapter().getInstance();
  express.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Health
  express.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
