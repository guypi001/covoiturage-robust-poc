import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';
import { Repository } from 'typeorm';
import { Booking } from './entities';

const registry = client.register;
client.collectDefaultMetrics({ register: registry });

export const bookingCreatedCounter = new client.Counter({
  name: 'booking_created_total',
  help: 'Nombre de réservations créées',
  labelNames: ['status'],
  registers: [registry],
});

export const bookingFailureCounter = new client.Counter({
  name: 'booking_failed_total',
  help: 'Nombre de réservations échouées',
  labelNames: ['reason'],
  registers: [registry],
});

export const bookingAmountHistogram = new client.Histogram({
  name: 'booking_amount_cfa',
  help: 'Distribution des montants de réservation',
  buckets: [0, 5000, 10000, 15000, 20000, 30000, 50000],
  registers: [registry],
});

export const bookingSeatsHistogram = new client.Histogram({
  name: 'booking_seats_total',
  help: 'Répartition du nombre de sièges réservés',
  buckets: [1, 2, 3, 4, 6],
  registers: [registry],
});

export const bookingStatusGauge = new client.Gauge({
  name: 'booking_status_total',
  help: 'Nombre de réservations par statut',
  labelNames: ['status'],
  registers: [registry],
});

export const bookingAmountGauge = new client.Gauge({
  name: 'booking_amount_sum_cfa',
  help: 'Montant cumulé des réservations confirmées',
  registers: [registry],
});

export async function refreshBookingGauges(repository: Repository<Booking>) {
  const statusRows = await repository
    .createQueryBuilder('booking')
    .select('booking.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('booking.status')
    .getRawMany();

  bookingStatusGauge.reset();
  for (const status of ['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED'] as const) {
    const row = statusRows.find((item) => item.status === status);
    bookingStatusGauge.set({ status }, Number(row?.count ?? 0));
  }

  const aggregates = await repository
    .createQueryBuilder('booking')
    .select('SUM(booking.amount)', 'sum')
    .where('booking.status IN (:...statuses)', { statuses: ['CONFIRMED', 'PAID'] })
    .getRawOne<{ sum: string | null }>();

  bookingAmountGauge.set(Number(aggregates?.sum ?? 0));
}

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly histogram = new client.Histogram({
    name: 'booking_http_server_duration_seconds',
    help: 'Durée des requêtes HTTP du service booking',
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
