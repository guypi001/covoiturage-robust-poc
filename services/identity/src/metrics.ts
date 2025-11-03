import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';

const registry = client.register;
client.collectDefaultMetrics({ register: registry });

export const accountCreatedCounter = new client.Counter({
  name: 'identity_account_created_total',
  help: 'Nombre de comptes créés par type',
  labelNames: ['type'],
  registers: [registry],
});

export const accountLoginCounter = new client.Counter({
  name: 'identity_account_login_total',
  help: 'Nombre de tentatives de connexion réussies',
  labelNames: ['type'],
  registers: [registry],
});

export const accountTypeGauge = new client.Gauge({
  name: 'identity_accounts_by_type',
  help: 'Nombre total de comptes par type',
  labelNames: ['type'],
  registers: [registry],
});

export const accountStatusGauge = new client.Gauge({
  name: 'identity_accounts_by_status',
  help: 'Nombre total de comptes par statut',
  labelNames: ['status'],
  registers: [registry],
});

export const accountProfileUpdateCounter = new client.Counter({
  name: 'identity_profile_update_total',
  help: 'Nombre de personnalisations de profil',
  labelNames: ['actor', 'type'],
  registers: [registry],
});

export const otpRequestCounter = new client.Counter({
  name: 'identity_otp_request_total',
  help: 'Demandes OTP par canal',
  labelNames: ['channel'],
  registers: [registry],
});

export const otpValidationCounter = new client.Counter({
  name: 'identity_otp_validation_total',
  help: 'Résultat des validations OTP',
  labelNames: ['result'],
  registers: [registry],
});

export const adminRideDigestCounter = new client.Counter({
  name: 'identity_admin_ride_digest_total',
  help: 'Diffusions de trajets par les administrateurs',
  labelNames: ['result'],
  registers: [registry],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private histogram = new client.Histogram({
    name: 'http_server_duration_seconds',
    help: 'HTTP request duration',
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
