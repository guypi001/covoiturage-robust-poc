import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';

const registry = client.register;
client.collectDefaultMetrics({ register: registry });

export const upstreamRequestCounter = new client.Counter({
  name: 'bff_upstream_requests_total',
  help: 'Nombre de requêtes effectuées vers les services internes',
  labelNames: ['target', 'outcome'],
  registers: [registry],
});

export const upstreamDurationHistogram = new client.Histogram({
  name: 'bff_upstream_duration_seconds',
  help: 'Durée des appels vers les services internes',
  labelNames: ['target'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly histogram = new client.Histogram({
    name: 'bff_http_server_duration_seconds',
    help: 'Durée des requêtes HTTP du BFF',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
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
