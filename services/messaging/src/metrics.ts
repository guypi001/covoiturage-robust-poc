import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';

const registry = client.register;
client.collectDefaultMetrics({ register: registry });

export const messageSentCounter = new client.Counter({
  name: 'messaging_messages_sent_total',
  help: 'Nombre de messages envoyés',
  labelNames: ['sender_type'],
  registers: [registry],
});

export const messageReadCounter = new client.Counter({
  name: 'messaging_messages_read_total',
  help: 'Nombre de messages marqués comme lus',
  labelNames: ['recipient_type'],
  registers: [registry],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private histogram = new client.Histogram({
    name: 'http_server_duration_seconds',
    help: 'Durée des requêtes HTTP',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [registry],
  });

  use(req: any, res: any, next: () => void) {
    const end = this.histogram.startTimer({ method: req.method, path: req.path });
    res.on('finish', () => end({ status: String(res.statusCode) }));
    next();
  }
}

@Controller()
export class MetricsController {
  @Get('/metrics')
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  }
}
