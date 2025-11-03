"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = exports.MetricsMiddleware = exports.fleetUpcomingGauge = exports.fleetSeatGauge = exports.fleetVehicleGauge = exports.rideLockLatencyHistogram = exports.rideStatusGauge = exports.rideSeatsTotalGauge = exports.rideSeatsAvailableGauge = exports.ridePriceHistogram = exports.rideLockAttemptCounter = exports.ridePublishedCounter = void 0;
exports.refreshRideGauges = refreshRideGauges;
exports.refreshFleetGauges = refreshFleetGauges;
const common_1 = require("@nestjs/common");
const client = __importStar(require("prom-client"));
const registry = client.register;
client.collectDefaultMetrics({ register: registry });
exports.ridePublishedCounter = new client.Counter({
    name: 'ride_published_total',
    help: 'Nombre de trajets publiés',
    labelNames: ['origin_city', 'destination_city'],
    registers: [registry],
});
exports.rideLockAttemptCounter = new client.Counter({
    name: 'ride_lock_attempt_total',
    help: 'Tentatives de réservation de sièges',
    labelNames: ['result'],
    registers: [registry],
});
exports.ridePriceHistogram = new client.Histogram({
    name: 'ride_price_per_seat_cfa',
    help: 'Distribution du prix par siège',
    buckets: [5, 10, 15, 20, 30, 40, 60],
    registers: [registry],
});
exports.rideSeatsAvailableGauge = new client.Gauge({
    name: 'ride_seats_available_total',
    help: 'Nombre total de places encore disponibles',
    registers: [registry],
});
exports.rideSeatsTotalGauge = new client.Gauge({
    name: 'ride_seats_capacity_total',
    help: 'Capacité totale de sièges publiée',
    registers: [registry],
});
exports.rideStatusGauge = new client.Gauge({
    name: 'ride_status_total',
    help: 'Nombre de trajets par statut',
    labelNames: ['status'],
    registers: [registry],
});
exports.rideLockLatencyHistogram = new client.Histogram({
    name: 'ride_lock_duration_seconds',
    help: 'Durée des opérations de blocage de sièges',
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
    registers: [registry],
});
exports.fleetVehicleGauge = new client.Gauge({
    name: 'ride_fleet_vehicle_total',
    help: 'Nombre de véhicules par statut',
    labelNames: ['status'],
    registers: [registry],
});
exports.fleetSeatGauge = new client.Gauge({
    name: 'ride_fleet_vehicle_seats_total',
    help: 'Capacité totale de sièges sur les véhicules actifs',
    registers: [registry],
});
exports.fleetUpcomingGauge = new client.Gauge({
    name: 'ride_fleet_upcoming_trips_total',
    help: 'Voyages planifiés à venir pour l’ensemble des véhicules',
    registers: [registry],
});
async function refreshRideGauges(repository) {
    const statusRows = await repository
        .createQueryBuilder('ride')
        .select('ride.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ride.status')
        .getRawMany();
    exports.rideStatusGauge.reset();
    for (const status of ['PUBLISHED', 'CLOSED']) {
        const row = statusRows.find((item) => item.status === status);
        exports.rideStatusGauge.set({ status }, Number(row?.count ?? 0));
    }
    const totals = await repository
        .createQueryBuilder('ride')
        .select('SUM(ride.seatsTotal)', 'totalSeats')
        .addSelect('SUM(ride.seatsAvailable)', 'availableSeats')
        .getRawOne();
    exports.rideSeatsTotalGauge.set(Number(totals?.totalSeats ?? 0));
    exports.rideSeatsAvailableGauge.set(Number(totals?.availableSeats ?? 0));
}
async function refreshFleetGauges(vehicleRepository, scheduleRepository) {
    const statusRows = await vehicleRepository
        .createQueryBuilder('vehicle')
        .select('vehicle.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('vehicle.status')
        .getRawMany();
    exports.fleetVehicleGauge.reset();
    for (const status of ['ACTIVE', 'INACTIVE']) {
        const row = statusRows.find((item) => item.status === status);
        exports.fleetVehicleGauge.set({ status }, Number(row?.count ?? 0));
    }
    const seatsAggregate = await vehicleRepository
        .createQueryBuilder('vehicle')
        .select('COALESCE(SUM(vehicle.seats), 0)', 'totalSeats')
        .where('vehicle.status = :status', { status: 'ACTIVE' })
        .getRawOne();
    exports.fleetSeatGauge.set(Number(seatsAggregate?.totalSeats ?? 0));
    const upcomingAggregate = await scheduleRepository
        .createQueryBuilder('schedule')
        .select('COUNT(*)', 'count')
        .where('schedule.status = :status', { status: 'PLANNED' })
        .andWhere('schedule.departureAt >= :now', { now: new Date() })
        .getRawOne();
    exports.fleetUpcomingGauge.set(Number(upcomingAggregate?.count ?? 0));
}
let MetricsMiddleware = class MetricsMiddleware {
    constructor() {
        this.histogram = new client.Histogram({
            name: 'ride_http_server_duration_seconds',
            help: 'Durée des requêtes HTTP du service ride',
            labelNames: ['method', 'path', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
            registers: [registry],
        });
    }
    use(req, res, next) {
        const end = this.histogram.startTimer({ method: req.method, path: req.path });
        res.on('finish', () => end({ status: String(res.statusCode) }));
        next();
    }
};
exports.MetricsMiddleware = MetricsMiddleware;
exports.MetricsMiddleware = MetricsMiddleware = __decorate([
    (0, common_1.Injectable)()
], MetricsMiddleware);
let MetricsController = class MetricsController {
    async metrics(res) {
        res.setHeader('Content-Type', registry.contentType);
        res.send(await registry.metrics());
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)('/metrics'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "metrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)()
], MetricsController);
//# sourceMappingURL=metrics.js.map