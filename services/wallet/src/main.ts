import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Healthcheck simple (on garde ici)
  const express = app.getHttpAdapter().getInstance();
  express.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`wallet listening on ${port}`);
}
bootstrap();
