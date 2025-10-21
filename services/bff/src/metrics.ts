import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';
client.collectDefaultMetrics();
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private histogram = new client.Histogram({ name: 'http_server_duration_seconds', help: 'HTTP request duration', labelNames: ['method','path','status'], buckets: [0.05,0.1,0.3,0.5,1,2,5] });
  use(req: any, res: any, next: () => void) {
    const end = this.histogram.startTimer({ method: req.method, path: req.path });
    res.on('finish', () => end({ status: String(res.statusCode) })); next();
  }
}
@Controller()
export class MetricsController {
  @Get('/metrics') async metrics(@Res() res: Response) { res.setHeader('Content-Type', client.register.contentType); res.send(await client.register.metrics()); }
}
