import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import * as client from 'prom-client';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // CORS si tu en as besoin pour l'IHM
  app.enableCors({
    origin: ['http://localhost:3006', 'http://localhost:5173'],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  // ---- Prometheus: utiliser un registry DÉDIÉ (pas le registre global)
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });

  const express = app.getHttpAdapter().getInstance();
  express.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  // Healthcheck (pratique pour Docker)
  express.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
