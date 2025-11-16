"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RideController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RideController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const event_bus_1 = require("./event-bus");
const metrics_1 = require("./metrics");
const axios_1 = __importDefault(require("axios"));
const IDENTITY_URL = process.env.IDENTITY_URL || 'http://identity:3000';
let RideController = RideController_1 = class RideController {
    constructor(rides, outboxes, bus) {
        this.rides = rides;
        this.outboxes = outboxes;
        this.bus = bus;
        this.logger = new common_1.Logger(RideController_1.name);
        void this.refreshAggregates();
    }
    async refreshAggregates() {
        try {
            await (0, metrics_1.refreshRideGauges)(this.rides);
        }
        catch (err) {
            this.logger.warn(`refreshAggregates failed: ${err?.message ?? err}`);
        }
    }
    async create(dto, req, res) {
        try {
            let driverId = dto.driverId;
            let driverLabel = dto.driverLabel ?? null;
            let driverPhotoUrl = dto.driverPhotoUrl ?? null;
            if (!driverId) {
                const authHeader = req.headers['authorization'];
                if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
                    const profile = await this.fetchProfile(authHeader);
                    if (profile?.id) {
                        driverId = profile.id;
                        driverLabel = driverLabel ?? profile.fullName ?? profile.companyName ?? profile.email ?? null;
                        driverPhotoUrl = driverPhotoUrl ?? profile.profilePhotoUrl ?? null;
                    }
                }
            }
            if (!driverId) {
                return res.status(common_1.HttpStatus.BAD_REQUEST).json({ error: 'driver_required' });
            }
            const ride = this.rides.create({
                driverId,
                driverLabel,
                driverPhotoUrl,
                originCity: dto.originCity,
                destinationCity: dto.destinationCity,
                departureAt: dto.departureAt,
                seatsTotal: dto.seatsTotal,
                seatsAvailable: dto.seatsAvailable ?? dto.seatsTotal,
                pricePerSeat: dto.pricePerSeat,
                status: 'PUBLISHED',
            });
            const saved = await this.rides.save(ride);
            const evt = {
                rideId: saved.id,
                status: saved.status,
                driverId: saved.driverId,
                driverLabel: saved.driverLabel,
                driverPhotoUrl: saved.driverPhotoUrl,
                originCity: saved.originCity,
                destinationCity: saved.destinationCity,
                departureAt: saved.departureAt,
                pricePerSeat: saved.pricePerSeat,
                seatsTotal: saved.seatsTotal,
                seatsAvailable: saved.seatsAvailable,
            };
            await this.bus.publish('ride.published', evt, saved.id);
            await this.outboxes.save(this.outboxes.create({ topic: 'ride.published', payload: evt, sent: false }));
            metrics_1.ridePublishedCounter.inc({ origin_city: saved.originCity, destination_city: saved.destinationCity });
            metrics_1.ridePriceHistogram.observe(saved.pricePerSeat);
            await this.refreshAggregates();
            return res.status(common_1.HttpStatus.CREATED).json(saved);
        }
        catch (e) {
            this.logger.error(`Ride creation failed: ${e?.message ?? e}`);
            return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'create_failed', detail: e?.message });
        }
    }
    async fetchProfile(authorization) {
        try {
            const { data } = await axios_1.default.get(`${IDENTITY_URL}/profiles/me`, {
                headers: { authorization },
                timeout: 3000,
            });
            return data;
        }
        catch (err) {
            this.logger.warn(`Unable to resolve driver profile: ${err?.message ?? err}`);
            return null;
        }
    }
    async resolveDriverId(req, fallback) {
        if (fallback)
            return fallback;
        const authHeader = req.headers['authorization'];
        if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
            const profile = await this.fetchProfile(authHeader);
            if (profile?.id) {
                return profile.id;
            }
        }
        return undefined;
    }
    summarizeRides(rides) {
        const now = Date.now();
        const upcoming = rides.filter((ride) => {
            const ts = Date.parse(ride.departureAt);
            return Number.isFinite(ts) && ts > now;
        }).length;
        const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
        const seatsBooked = rides.reduce((acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable), 0);
        const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
        return { upcoming, published, seatsBooked, seatsTotal };
    }
    async listMine(req, query, res) {
        try {
            const driverId = await this.resolveDriverId(req, query?.driverId);
            if (!driverId) {
                throw new common_1.ForbiddenException('driver_required');
            }
            const limit = Math.min(Math.max(Number(query?.limit ?? 50) || 50, 1), 200);
            const offset = Math.max(Number(query?.offset ?? 0) || 0, 0);
            const qb = this.rides.createQueryBuilder('ride').where('ride.driverId = :driverId', { driverId });
            if (query?.status) {
                qb.andWhere('ride.status = :status', { status: query.status });
            }
            if (query?.origin) {
                qb.andWhere('ride.originCity ILIKE :origin', { origin: `%${query.origin}%` });
            }
            if (query?.destination) {
                qb.andWhere('ride.destinationCity ILIKE :destination', { destination: `%${query.destination}%` });
            }
            if (query?.departureAfter) {
                qb.andWhere('ride.departureAt >= :departureAfter', { departureAfter: query.departureAfter });
            }
            if (query?.departureBefore) {
                qb.andWhere('ride.departureAt <= :departureBefore', { departureBefore: query.departureBefore });
            }
            const sort = query?.sort?.toLowerCase();
            if (sort === 'price_asc')
                qb.orderBy('ride.pricePerSeat', 'ASC');
            else if (sort === 'price_desc')
                qb.orderBy('ride.pricePerSeat', 'DESC');
            else if (sort === 'departure_asc')
                qb.orderBy('ride.departureAt', 'ASC');
            else
                qb.orderBy('ride.departureAt', 'DESC');
            qb.skip(offset);
            qb.take(limit);
            const [items, total] = await qb.getManyAndCount();
            return res.status(common_1.HttpStatus.OK).json({
                data: items,
                total,
                offset,
                limit,
                summary: this.summarizeRides(items),
            });
        }
        catch (err) {
            const status = err instanceof common_1.ForbiddenException
                ? common_1.HttpStatus.FORBIDDEN
                : err?.status ?? common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({ error: err?.message ?? 'mine_failed' });
        }
    }
    async getOne(id) {
        const ride = await this.rides.findOne({ where: { id } });
        return ride ?? { error: 'not_found' };
    }
    async lock(id, body, res) {
        const endTimer = metrics_1.rideLockLatencyHistogram.startTimer();
        try {
            const ride = await this.rides.findOne({ where: { id } });
            if (!ride) {
                metrics_1.rideLockAttemptCounter.inc({ result: 'not_found' });
                return res.status(common_1.HttpStatus.NOT_FOUND).json({ error: 'not_found' });
            }
            const n = Number(body?.seats ?? 1);
            if (!Number.isFinite(n) || n <= 0) {
                metrics_1.rideLockAttemptCounter.inc({ result: 'invalid_request' });
                return res.status(common_1.HttpStatus.BAD_REQUEST).json({ error: 'invalid_seats' });
            }
            if (ride.seatsAvailable < n) {
                metrics_1.rideLockAttemptCounter.inc({ result: 'conflict' });
                return res.status(common_1.HttpStatus.CONFLICT).json({ error: 'not_enough_seats' });
            }
            ride.seatsAvailable -= n;
            await this.rides.save(ride);
            metrics_1.rideLockAttemptCounter.inc({ result: 'success' });
            await this.refreshAggregates();
            return res.status(common_1.HttpStatus.OK).json({ ok: true, seatsAvailable: ride.seatsAvailable });
        }
        catch (err) {
            metrics_1.rideLockAttemptCounter.inc({ result: 'error' });
            this.logger.error(`Ride lock failed: ${err?.message ?? err}`);
            return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'lock_failed' });
        }
        finally {
            endTimer();
        }
    }
};
exports.RideController = RideController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RideController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mine'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RideController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RideController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(':id/lock'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RideController.prototype, "lock", null);
exports.RideController = RideController = RideController_1 = __decorate([
    (0, common_1.Controller)('rides'),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Ride)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Outbox)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_bus_1.EventBus])
], RideController);
//# sourceMappingURL=ride.controller.js.map