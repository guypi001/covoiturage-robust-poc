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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRideController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const internal_guard_1 = require("./internal.guard");
const dto_1 = require("./dto");
let AdminRideController = class AdminRideController {
    constructor(rides) {
        this.rides = rides;
    }
    async list(query) {
        const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 500);
        const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
        const qb = this.rides.createQueryBuilder('ride');
        if (query.driverId) {
            qb.andWhere('ride.driverId = :driverId', { driverId: query.driverId });
        }
        if (query.status) {
            qb.andWhere('ride.status = :status', { status: query.status });
        }
        if (query.search) {
            const pattern = `%${query.search.trim()}%`;
            qb.andWhere('(ride.originCity ILIKE :pattern OR ride.destinationCity ILIKE :pattern)', {
                pattern,
            });
        }
        if (query.origin) {
            qb.andWhere('ride.originCity ILIKE :origin', { origin: `%${query.origin.trim()}%` });
        }
        if (query.destination) {
            qb.andWhere('ride.destinationCity ILIKE :destination', {
                destination: `%${query.destination.trim()}%`,
            });
        }
        if (query.departureAfter) {
            qb.andWhere('ride.departureAt >= :departureAfter', {
                departureAfter: query.departureAfter,
            });
        }
        if (query.departureBefore) {
            qb.andWhere('ride.departureAt <= :departureBefore', {
                departureBefore: query.departureBefore,
            });
        }
        const sort = query.sort?.toLowerCase();
        if (sort === 'departure_asc') {
            qb.orderBy('ride.departureAt', 'ASC');
        }
        else if (sort === 'departure_desc') {
            qb.orderBy('ride.departureAt', 'DESC');
        }
        else if (sort === 'price_asc') {
            qb.orderBy('ride.pricePerSeat', 'ASC');
        }
        else if (sort === 'price_desc') {
            qb.orderBy('ride.pricePerSeat', 'DESC');
        }
        else {
            qb.orderBy('ride.createdAt', 'DESC');
        }
        qb.skip(offset);
        qb.take(limit);
        const [items, total] = await qb.getManyAndCount();
        const summary = this.computeSummary(items);
        return {
            data: items,
            total,
            offset,
            limit,
            summary,
        };
    }
    async detail(id) {
        return this.rides.findOne({ where: { id } });
    }
    async update(id, dto) {
        const ride = await this.rides.findOne({ where: { id } });
        if (!ride) {
            throw new common_1.NotFoundException('ride_not_found');
        }
        const reservedSeats = ride.seatsTotal - ride.seatsAvailable;
        const nextTotal = dto.seatsTotal ?? ride.seatsTotal;
        if (nextTotal < reservedSeats) {
            throw new common_1.BadRequestException('seats_total_too_low');
        }
        let nextAvailable = dto.seatsAvailable ?? ride.seatsAvailable;
        if (dto.seatsTotal !== undefined && dto.seatsAvailable === undefined) {
            nextAvailable = Math.max(0, nextTotal - reservedSeats);
        }
        if (nextAvailable > nextTotal) {
            throw new common_1.BadRequestException('seats_available_too_high');
        }
        if (dto.originCity !== undefined) {
            const trimmed = dto.originCity.trim();
            if (!trimmed) {
                throw new common_1.BadRequestException('origin_required');
            }
            ride.originCity = trimmed;
        }
        if (dto.destinationCity !== undefined) {
            const trimmed = dto.destinationCity.trim();
            if (!trimmed) {
                throw new common_1.BadRequestException('destination_required');
            }
            ride.destinationCity = trimmed;
        }
        if (dto.departureAt) {
            if (!Number.isFinite(Date.parse(dto.departureAt))) {
                throw new common_1.BadRequestException('invalid_departure');
            }
            ride.departureAt = new Date(dto.departureAt).toISOString();
        }
        if (dto.pricePerSeat !== undefined) {
            ride.pricePerSeat = dto.pricePerSeat;
        }
        ride.seatsTotal = nextTotal;
        ride.seatsAvailable = nextAvailable;
        if (dto.status) {
            ride.status = dto.status;
            if (dto.status === 'CLOSED') {
                ride.seatsAvailable = 0;
            }
        }
        return this.rides.save(ride);
    }
    async close(id) {
        const ride = await this.rides.findOne({ where: { id } });
        if (!ride) {
            throw new common_1.NotFoundException('ride_not_found');
        }
        ride.status = 'CLOSED';
        ride.seatsAvailable = 0;
        return this.rides.save(ride);
    }
    computeSummary(rides) {
        const now = Date.now();
        const upcoming = rides.filter((ride) => {
            const ts = Date.parse(ride.departureAt);
            return Number.isFinite(ts) && ts > now;
        }).length;
        const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
        const seatsBooked = rides.reduce((acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable), 0);
        const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
        const averagePrice = rides.length > 0
            ? Math.round(rides.reduce((acc, ride) => acc + ride.pricePerSeat, 0) / rides.length)
            : 0;
        const occupancyRate = seatsTotal > 0 ? seatsBooked / seatsTotal : 0;
        const byStatus = rides.reduce((acc, ride) => {
            acc[ride.status] = (acc[ride.status] ?? 0) + 1;
            return acc;
        }, {});
        const routeCount = rides.reduce((acc, ride) => {
            const key = `${ride.originCity}→${ride.destinationCity}`;
            if (!acc[key]) {
                acc[key] = {
                    origin: ride.originCity,
                    destination: ride.destinationCity,
                    count: 0,
                };
            }
            acc[key].count += 1;
            return acc;
        }, {});
        const topRoutes = Object.values(routeCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return { upcoming, published, seatsBooked, seatsTotal, averagePrice, occupancyRate, byStatus, topRoutes };
    }
};
exports.AdminRideController = AdminRideController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminRideController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminRideController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AdminUpdateRideDto]),
    __metadata("design:returntype", Promise)
], AdminRideController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminRideController.prototype, "close", null);
exports.AdminRideController = AdminRideController = __decorate([
    (0, common_1.Controller)('admin/rides'),
    (0, common_1.UseGuards)(internal_guard_1.InternalGuard),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Ride)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AdminRideController);
//# sourceMappingURL=admin.controller.js.map