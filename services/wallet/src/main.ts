import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import * as client from 'prom-client';
import { Request, Response } from 'express';

function setupMetrics(app: any) {
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });

  const express = app.getHttpAdapter().getInstance();
  express.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  express.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  setupMetrics(app);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`wallet listening on ${port}`);
}
bootstrap();
