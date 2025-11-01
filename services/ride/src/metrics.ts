import { Injectable, NestMiddleware, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';
import { Repository } from 'typeorm';
import { FleetVehicle, Ride, VehicleSchedule } from './entities';

const registry = client.register;
client.collectDefaultMetrics({ register: registry });

export const ridePublishedCounter = new client.Counter({
  name: 'ride_published_total',
  help: 'Nombre de trajets publiés',
  labelNames: ['origin_city', 'destination_city'],
  registers: [registry],
});

export const rideLockAttemptCounter = new client.Counter({
  name: 'ride_lock_attempt_total',
  help: 'Tentatives de réservation de sièges',
  labelNames: ['result'],
  registers: [registry],
});

export const ridePriceHistogram = new client.Histogram({
  name: 'ride_price_per_seat_cfa',
  help: 'Distribution du prix par siège',
  buckets: [5, 10, 15, 20, 30, 40, 60],
  registers: [registry],
});

export const rideSeatsAvailableGauge = new client.Gauge({
  name: 'ride_seats_available_total',
  help: 'Nombre total de places encore disponibles',
  registers: [registry],
});

export const rideSeatsTotalGauge = new client.Gauge({
  name: 'ride_seats_capacity_total',
  help: 'Capacité totale de sièges publiée',
  registers: [registry],
});

export const rideStatusGauge = new client.Gauge({
  name: 'ride_status_total',
  help: 'Nombre de trajets par statut',
  labelNames: ['status'],
  registers: [registry],
});

export const rideLockLatencyHistogram = new client.Histogram({
  name: 'ride_lock_duration_seconds',
  help: 'Durée des opérations de blocage de sièges',
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [registry],
});

export const fleetVehicleGauge = new client.Gauge({
  name: 'ride_fleet_vehicle_total',
  help: 'Nombre de véhicules par statut',
  labelNames: ['status'],
  registers: [registry],
});

export const fleetSeatGauge = new client.Gauge({
  name: 'ride_fleet_vehicle_seats_total',
  help: 'Capacité totale de sièges sur les véhicules actifs',
  registers: [registry],
});

export const fleetUpcomingGauge = new client.Gauge({
  name: 'ride_fleet_upcoming_trips_total',
  help: 'Voyages planifiés à venir pour l’ensemble des véhicules',
  registers: [registry],
});

export async function refreshRideGauges(repository: Repository<Ride>) {
  const statusRows = await repository
    .createQueryBuilder('ride')
    .select('ride.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('ride.status')
    .getRawMany();

  rideStatusGauge.reset();
  for (const status of ['PUBLISHED', 'CLOSED'] as const) {
    const row = statusRows.find((item) => item.status === status);
    rideStatusGauge.set({ status }, Number(row?.count ?? 0));
  }

  const totals = await repository
    .createQueryBuilder('ride')
    .select('SUM(ride.seatsTotal)', 'totalSeats')
    .addSelect('SUM(ride.seatsAvailable)', 'availableSeats')
    .getRawOne<{ totalSeats: string | null; availableSeats: string | null }>();

  rideSeatsTotalGauge.set(Number(totals?.totalSeats ?? 0));
  rideSeatsAvailableGauge.set(Number(totals?.availableSeats ?? 0));
}

export async function refreshFleetGauges(
  vehicleRepository: Repository<FleetVehicle>,
  scheduleRepository: Repository<VehicleSchedule>,
) {
  const statusRows = await vehicleRepository
    .createQueryBuilder('vehicle')
    .select('vehicle.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('vehicle.status')
    .getRawMany<{ status: string; count: string }>();

  fleetVehicleGauge.reset();
  for (const status of ['ACTIVE', 'INACTIVE'] as const) {
    const row = statusRows.find((item) => item.status === status);
    fleetVehicleGauge.set({ status }, Number(row?.count ?? 0));
  }

  const seatsAggregate = await vehicleRepository
    .createQueryBuilder('vehicle')
    .select('COALESCE(SUM(vehicle.seats), 0)', 'totalSeats')
    .where('vehicle.status = :status', { status: 'ACTIVE' })
    .getRawOne<{ totalSeats: string }>();
  fleetSeatGauge.set(Number(seatsAggregate?.totalSeats ?? 0));

  const upcomingAggregate = await scheduleRepository
    .createQueryBuilder('schedule')
    .select('COUNT(*)', 'count')
    .where('schedule.status = :status', { status: 'PLANNED' })
    .andWhere('schedule.departureAt >= :now', { now: new Date() })
    .getRawOne<{ count: string }>();
  fleetUpcomingGauge.set(Number(upcomingAggregate?.count ?? 0));
}

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly histogram = new client.Histogram({
    name: 'ride_http_server_duration_seconds',
    help: 'Durée des requêtes HTTP du service ride',
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
