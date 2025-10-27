import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { ValidationPipe } from '@nestjs/common';
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  app.enableCors({
    origin: ['http://localhost:3006', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupMetrics(app);

  const port = Number(process.env.PORT) || 3012;
  await app.listen(port, '0.0.0.0');
  console.log('Messaging service listening on', port);
}

bootstrap();
