// services/booking/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import * as client from 'prom-client';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // CORS (IHM)
  const corsOptions: CorsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.enableCors(corsOptions);

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
