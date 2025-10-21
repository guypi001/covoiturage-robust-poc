import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import * as client from 'prom-client';
import { Request, Response } from 'express';

function setupMetrics(app: any) {
  // Évite le crash si le process redémarre : on vide le registre avant de ré-enregistrer
  client.register.clear();
  client.collectDefaultMetrics();

  const express = app.getHttpAdapter().getInstance();
  express.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  // Health
  express.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // CORS pour l’IHM (nginx webapp 3006) + Vite éventuel (5173)
  app.enableCors({
    origin: ['http://localhost:3006', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupMetrics(app);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
