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
exports.FleetAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const dto_1 = require("./dto");
const internal_guard_1 = require("./internal.guard");
const metrics_1 = require("./metrics");
let FleetAdminController = class FleetAdminController {
    constructor(vehicles, schedules) {
        this.vehicles = vehicles;
        this.schedules = schedules;
    }
    async listVehicles(companyId, query) {
        const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 200);
        const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
        const statusFilter = query.status === 'ALL' ? null : query.status ?? 'ACTIVE';
        const qb = this.vehicles
            .createQueryBuilder('vehicle')
            .where('vehicle.companyId = :companyId', { companyId });
        if (statusFilter) {
            qb.andWhere('vehicle.status = :status', { status: statusFilter });
        }
        if (query.search?.trim()) {
            const pattern = `%${query.search.trim()}%`;
            qb.andWhere('(vehicle.label ILIKE :pattern OR vehicle.plateNumber ILIKE :pattern OR vehicle.brand ILIKE :pattern OR vehicle.model ILIKE :pattern)', { pattern });
        }
        qb.orderBy('vehicle.createdAt', 'DESC').skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        const vehicleIds = items.map((vehicle) => vehicle.id);
        const upcomingByVehicle = new Map();
        if (vehicleIds.length > 0) {
            const upcoming = await this.schedules.find({
                where: {
                    vehicleId: (0, typeorm_2.In)(vehicleIds),
                    status: 'PLANNED',
                    departureAt: (0, typeorm_2.MoreThan)(new Date()),
                },
                order: { departureAt: 'ASC' },
            });
            for (const schedule of upcoming) {
                const entry = upcomingByVehicle.get(schedule.vehicleId) ??
                    { count: 0, nextDeparture: null, samples: [] };
                entry.count += 1;
                if (!entry.nextDeparture) {
                    entry.nextDeparture = schedule.departureAt;
                }
                if (entry.samples.length < 3) {
                    entry.samples.push(schedule);
                }
                upcomingByVehicle.set(schedule.vehicleId, entry);
            }
        }
        const [activeCount, inactiveCount, seatsAggregate, upcomingTotal] = await Promise.all([
            this.vehicles.count({ where: { companyId, status: 'ACTIVE' } }),
            this.vehicles.count({ where: { companyId, status: 'INACTIVE' } }),
            this.vehicles
                .createQueryBuilder('vehicle')
                .select('COALESCE(SUM(vehicle.seats), 0)', 'totalSeats')
                .where('vehicle.companyId = :companyId', { companyId })
                .getRawOne(),
            this.schedules.count({
                where: {
                    companyId,
                    status: 'PLANNED',
                    departureAt: (0, typeorm_2.MoreThan)(new Date()),
                },
            }),
        ]);
        const data = items.map((vehicle) => {
            const stats = upcomingByVehicle.get(vehicle.id);
            return {
                ...vehicle,
                metrics: {
                    upcomingTrips: stats?.count ?? 0,
                    nextDepartureAt: stats?.nextDeparture ?? null,
                },
                upcomingSchedules: (stats?.samples ?? []).map((schedule) => ({
                    ...schedule,
                })),
            };
        });
        return {
            data,
            total,
            offset,
            limit,
            summary: {
                active: activeCount,
                inactive: inactiveCount,
                fleetSeats: Number(seatsAggregate?.totalSeats ?? 0),
                upcomingTrips: upcomingTotal,
            },
        };
    }
    async createVehicle(companyId, dto) {
        const plate = dto.plateNumber.trim().toUpperCase();
        const existing = await this.vehicles.findOne({ where: { plateNumber: plate } });
        if (existing) {
            throw new common_1.BadRequestException('plate_already_registered');
        }
        const record = this.vehicles.create({
            companyId,
            label: dto.label.trim(),
            plateNumber: plate,
            category: dto.category.trim().toUpperCase(),
            seats: dto.seats,
            brand: dto.brand?.trim() || null,
            model: dto.model?.trim() || null,
            year: dto.year ?? null,
            amenities: dto.amenities?.map((item) => item.trim()).filter(Boolean) ?? null,
            specs: dto.specs ?? null,
            status: 'ACTIVE',
        });
        const saved = await this.vehicles.save(record);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
    async updateVehicle(companyId, vehicleId, dto) {
        const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
        if (!vehicle) {
            throw new common_1.NotFoundException('vehicle_not_found');
        }
        if (dto.label !== undefined)
            vehicle.label = dto.label.trim();
        if (dto.category !== undefined)
            vehicle.category = dto.category.trim().toUpperCase();
        if (dto.brand !== undefined)
            vehicle.brand = dto.brand?.trim() || null;
        if (dto.model !== undefined)
            vehicle.model = dto.model?.trim() || null;
        if (dto.year !== undefined)
            vehicle.year = dto.year ?? null;
        if (dto.seats !== undefined)
            vehicle.seats = dto.seats;
        if (dto.amenities !== undefined) {
            vehicle.amenities = dto.amenities?.map((item) => item.trim()).filter(Boolean) ?? null;
        }
        if (dto.specs !== undefined)
            vehicle.specs = dto.specs ?? null;
        if (dto.status !== undefined)
            vehicle.status = dto.status;
        const saved = await this.vehicles.save(vehicle);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
    async archiveVehicle(companyId, vehicleId) {
        const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
        if (!vehicle) {
            throw new common_1.NotFoundException('vehicle_not_found');
        }
        vehicle.status = 'INACTIVE';
        const saved = await this.vehicles.save(vehicle);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
    async listSchedules(companyId, vehicleId, query) {
        const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
        if (!vehicle) {
            throw new common_1.NotFoundException('vehicle_not_found');
        }
        const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
        const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
        const qb = this.schedules
            .createQueryBuilder('schedule')
            .where('schedule.companyId = :companyId', { companyId })
            .andWhere('schedule.vehicleId = :vehicleId', { vehicleId });
        if (query.status && query.status !== 'ALL') {
            qb.andWhere('schedule.status = :status', { status: query.status });
        }
        const now = new Date();
        if (query.window === 'upcoming') {
            qb.andWhere('schedule.departureAt >= :now', { now });
            qb.orderBy('schedule.departureAt', 'ASC');
        }
        else if (query.window === 'past') {
            qb.andWhere('schedule.departureAt < :now', { now });
            qb.orderBy('schedule.departureAt', 'DESC');
        }
        else {
            qb.orderBy('schedule.departureAt', 'DESC');
        }
        qb.skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        const summary = await this.schedules
            .createQueryBuilder('schedule')
            .select('schedule.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('schedule.companyId = :companyId', { companyId })
            .andWhere('schedule.vehicleId = :vehicleId', { vehicleId })
            .groupBy('schedule.status')
            .getRawMany();
        const summaryMap = summary.reduce((acc, row) => {
            acc[row.status] = Number(row.count ?? 0);
            return acc;
        }, {});
        return {
            data: items,
            total,
            offset,
            limit,
            summary: {
                planned: summaryMap.PLANNED ?? 0,
                completed: summaryMap.COMPLETED ?? 0,
                cancelled: summaryMap.CANCELLED ?? 0,
            },
        };
    }
    async createSchedule(companyId, vehicleId, dto) {
        const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
        if (!vehicle) {
            throw new common_1.NotFoundException('vehicle_not_found');
        }
        const departure = new Date(dto.departureAt);
        if (!Number.isFinite(departure.getTime())) {
            throw new common_1.BadRequestException('invalid_departure');
        }
        if (departure.getTime() < Date.now() - 5 * 60 * 1000) {
            throw new common_1.BadRequestException('departure_in_past');
        }
        let arrival = null;
        if (dto.arrivalEstimate) {
            arrival = new Date(dto.arrivalEstimate);
            if (!Number.isFinite(arrival.getTime())) {
                throw new common_1.BadRequestException('invalid_arrival');
            }
            if (arrival.getTime() <= departure.getTime()) {
                throw new common_1.BadRequestException('arrival_before_departure');
            }
        }
        const plannedSeats = dto.plannedSeats ?? vehicle.seats;
        if (plannedSeats > vehicle.seats) {
            throw new common_1.BadRequestException('planned_seats_exceed_vehicle_capacity');
        }
        const schedule = this.schedules.create({
            companyId,
            vehicleId: vehicle.id,
            originCity: dto.originCity.trim(),
            destinationCity: dto.destinationCity.trim(),
            departureAt: departure,
            arrivalEstimate: arrival,
            plannedSeats,
            pricePerSeat: dto.pricePerSeat ?? 0,
            recurrence: dto.recurrence ?? 'NONE',
            status: 'PLANNED',
            notes: dto.notes?.trim() || null,
            metadata: dto.metadata ?? null,
        });
        const saved = await this.schedules.save(schedule);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
    async updateSchedule(companyId, vehicleId, scheduleId, dto) {
        const schedule = await this.schedules.findOne({
            where: { id: scheduleId, vehicleId, companyId },
        });
        if (!schedule) {
            throw new common_1.NotFoundException('schedule_not_found');
        }
        if (dto.originCity !== undefined)
            schedule.originCity = dto.originCity.trim();
        if (dto.destinationCity !== undefined)
            schedule.destinationCity = dto.destinationCity.trim();
        if (dto.departureAt !== undefined) {
            const departure = new Date(dto.departureAt);
            if (!Number.isFinite(departure.getTime())) {
                throw new common_1.BadRequestException('invalid_departure');
            }
            schedule.departureAt = departure;
        }
        if (dto.arrivalEstimate !== undefined) {
            if (dto.arrivalEstimate === null) {
                schedule.arrivalEstimate = null;
            }
            else {
                const arrival = new Date(dto.arrivalEstimate);
                if (!Number.isFinite(arrival.getTime())) {
                    throw new common_1.BadRequestException('invalid_arrival');
                }
                schedule.arrivalEstimate = arrival;
            }
        }
        if (dto.plannedSeats !== undefined) {
            const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
            if (!vehicle) {
                throw new common_1.NotFoundException('vehicle_not_found');
            }
            if (dto.plannedSeats > vehicle.seats) {
                throw new common_1.BadRequestException('planned_seats_exceed_vehicle_capacity');
            }
            schedule.plannedSeats = dto.plannedSeats;
        }
        if (dto.pricePerSeat !== undefined)
            schedule.pricePerSeat = dto.pricePerSeat;
        if (dto.recurrence !== undefined)
            schedule.recurrence = dto.recurrence;
        if (dto.notes !== undefined)
            schedule.notes = dto.notes?.trim() || null;
        if (dto.metadata !== undefined)
            schedule.metadata = dto.metadata ?? null;
        if (dto.status !== undefined)
            schedule.status = dto.status;
        if (dto.reservedSeats !== undefined)
            schedule.reservedSeats = dto.reservedSeats;
        const saved = await this.schedules.save(schedule);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
    async cancelSchedule(companyId, vehicleId, scheduleId) {
        const schedule = await this.schedules.findOne({
            where: { id: scheduleId, vehicleId, companyId },
        });
        if (!schedule) {
            throw new common_1.NotFoundException('schedule_not_found');
        }
        schedule.status = 'CANCELLED';
        const saved = await this.schedules.save(schedule);
        await (0, metrics_1.refreshFleetGauges)(this.vehicles, this.schedules);
        return saved;
    }
};
exports.FleetAdminController = FleetAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "listVehicles", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateVehicleDto]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "createVehicle", null);
__decorate([
    (0, common_1.Patch)(':vehicleId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.UpdateVehicleDto]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "updateVehicle", null);
__decorate([
    (0, common_1.Delete)(':vehicleId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "archiveVehicle", null);
__decorate([
    (0, common_1.Get)(':vehicleId/schedules'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "listSchedules", null);
__decorate([
    (0, common_1.Post)(':vehicleId/schedules'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.CreateScheduleDto]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "createSchedule", null);
__decorate([
    (0, common_1.Patch)(':vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, dto_1.UpdateScheduleDto]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "updateSchedule", null);
__decorate([
    (0, common_1.Delete)(':vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FleetAdminController.prototype, "cancelSchedule", null);
exports.FleetAdminController = FleetAdminController = __decorate([
    (0, common_1.Controller)('admin/companies/:companyId/vehicles'),
    (0, common_1.UseGuards)(internal_guard_1.InternalGuard),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.FleetVehicle)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.VehicleSchedule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], FleetAdminController);
//# sourceMappingURL=fleet.controller.js.map