import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { FleetVehicle, VehicleSchedule } from './entities';
import {
  CreateScheduleDto,
  CreateVehicleDto,
  UpdateScheduleDto,
  UpdateVehicleDto,
} from './dto';
import { InternalGuard } from './internal.guard';
import { refreshFleetGauges } from './metrics';

const METRICS_REFRESH_DEBOUNCE_MS = 5000;

type VehicleListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  limit?: string;
  offset?: string;
};

type ScheduleListQuery = {
  status?: 'PLANNED' | 'COMPLETED' | 'CANCELLED' | 'ALL';
  window?: 'upcoming' | 'past' | 'all';
  limit?: string;
  offset?: string;
};

@Controller('admin/companies/:companyId/vehicles')
@UseGuards(InternalGuard)
export class FleetAdminController {
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private refreshInFlight = false;

  constructor(
    @InjectRepository(FleetVehicle)
    private readonly vehicles: Repository<FleetVehicle>,
    @InjectRepository(VehicleSchedule)
    private readonly schedules: Repository<VehicleSchedule>,
  ) {}

  private async refreshFleetAggregates() {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      await refreshFleetGauges(this.vehicles, this.schedules);
    } finally {
      this.refreshInFlight = false;
    }
  }

  private queueRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshFleetAggregates();
    }, METRICS_REFRESH_DEBOUNCE_MS);
  }

  @Get()
  async listVehicles(@Param('companyId') companyId: string, @Query() query: VehicleListQuery) {
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
      qb.andWhere(
        '(vehicle.label ILIKE :pattern OR vehicle.plateNumber ILIKE :pattern OR vehicle.brand ILIKE :pattern OR vehicle.model ILIKE :pattern)',
        { pattern },
      );
    }

    qb.orderBy('vehicle.createdAt', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const vehicleIds = items.map((vehicle) => vehicle.id);
    const upcomingByVehicle = new Map<
      string,
      { count: number; nextDeparture?: Date | null; samples: VehicleSchedule[] }
    >();

    if (vehicleIds.length > 0) {
      const upcoming = await this.schedules.find({
        where: {
          vehicleId: In(vehicleIds),
          status: 'PLANNED',
          departureAt: MoreThan(new Date()),
        },
        order: { departureAt: 'ASC' },
      });
      for (const schedule of upcoming) {
        const entry =
          upcomingByVehicle.get(schedule.vehicleId) ??
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
        .getRawOne<{ totalSeats: string }>(),
      this.schedules.count({
        where: {
          companyId,
          status: 'PLANNED',
          departureAt: MoreThan(new Date()),
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

  @Post()
  async createVehicle(
    @Param('companyId') companyId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    const plate = dto.plateNumber.trim().toUpperCase();
    const existing = await this.vehicles.findOne({ where: { plateNumber: plate } });
    if (existing) {
      throw new BadRequestException('plate_already_registered');
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
    this.queueRefresh();
    return saved;
  }

  @Patch(':vehicleId')
  async updateVehicle(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
    if (!vehicle) {
      throw new NotFoundException('vehicle_not_found');
    }

    if (dto.label !== undefined) vehicle.label = dto.label.trim();
    if (dto.category !== undefined) vehicle.category = dto.category.trim().toUpperCase();
    if (dto.brand !== undefined) vehicle.brand = dto.brand?.trim() || null;
    if (dto.model !== undefined) vehicle.model = dto.model?.trim() || null;
    if (dto.year !== undefined) vehicle.year = dto.year ?? null;
    if (dto.seats !== undefined) vehicle.seats = dto.seats;
    if (dto.amenities !== undefined) {
      vehicle.amenities = dto.amenities?.map((item) => item.trim()).filter(Boolean) ?? null;
    }
    if (dto.specs !== undefined) vehicle.specs = dto.specs ?? null;
    if (dto.status !== undefined) vehicle.status = dto.status;

    const saved = await this.vehicles.save(vehicle);
    this.queueRefresh();
    return saved;
  }

  @Delete(':vehicleId')
  async archiveVehicle(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
    if (!vehicle) {
      throw new NotFoundException('vehicle_not_found');
    }
    vehicle.status = 'INACTIVE';
    const saved = await this.vehicles.save(vehicle);
    this.queueRefresh();
    return saved;
  }

  @Get(':vehicleId/schedules')
  async listSchedules(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
    @Query() query: ScheduleListQuery,
  ) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
    if (!vehicle) {
      throw new NotFoundException('vehicle_not_found');
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
    } else if (query.window === 'past') {
      qb.andWhere('schedule.departureAt < :now', { now });
      qb.orderBy('schedule.departureAt', 'DESC');
    } else {
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
      .getRawMany<{ status: string; count: string }>();

    const summaryMap = summary.reduce<Record<string, number>>((acc, row) => {
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

  @Post(':vehicleId/schedules')
  async createSchedule(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
    if (!vehicle) {
      throw new NotFoundException('vehicle_not_found');
    }

    const departure = new Date(dto.departureAt);
    if (!Number.isFinite(departure.getTime())) {
      throw new BadRequestException('invalid_departure');
    }
    if (departure.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException('departure_in_past');
    }

    let arrival: Date | null = null;
    if (dto.arrivalEstimate) {
      arrival = new Date(dto.arrivalEstimate);
      if (!Number.isFinite(arrival.getTime())) {
        throw new BadRequestException('invalid_arrival');
      }
      if (arrival.getTime() <= departure.getTime()) {
        throw new BadRequestException('arrival_before_departure');
      }
    }

    const plannedSeats = dto.plannedSeats ?? vehicle.seats;
    if (plannedSeats > vehicle.seats) {
      throw new BadRequestException('planned_seats_exceed_vehicle_capacity');
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
    this.queueRefresh();
    return saved;
  }

  @Patch(':vehicleId/schedules/:scheduleId')
  async updateSchedule(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    const schedule = await this.schedules.findOne({
      where: { id: scheduleId, vehicleId, companyId },
    });
    if (!schedule) {
      throw new NotFoundException('schedule_not_found');
    }

    if (dto.originCity !== undefined) {
      schedule.originCity = dto.originCity.trim();
    }
    if (dto.destinationCity !== undefined) {
      schedule.destinationCity = dto.destinationCity.trim();
    }

    const nextDeparture =
      dto.departureAt !== undefined ? new Date(dto.departureAt) : schedule.departureAt;
    if (!Number.isFinite(nextDeparture.getTime())) {
      throw new BadRequestException('invalid_departure');
    }
    if (dto.departureAt !== undefined && nextDeparture.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BadRequestException('departure_in_past');
    }

    let nextArrival: Date | null =
      dto.arrivalEstimate !== undefined
        ? dto.arrivalEstimate === null
          ? null
          : new Date(dto.arrivalEstimate)
        : schedule.arrivalEstimate ?? null;
    if (nextArrival && !Number.isFinite(nextArrival.getTime())) {
      throw new BadRequestException('invalid_arrival');
    }

    if (nextArrival && nextArrival.getTime() <= nextDeparture.getTime()) {
      throw new BadRequestException('arrival_before_departure');
    }

    const plannedSeatsRaw =
      dto.plannedSeats !== undefined ? dto.plannedSeats : schedule.plannedSeats;
    const nextPlannedSeats = Number(plannedSeatsRaw);
    if (!Number.isFinite(nextPlannedSeats) || nextPlannedSeats <= 0) {
      throw new BadRequestException('invalid_planned_seats');
    }

    if (dto.plannedSeats !== undefined) {
      const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, companyId } });
      if (!vehicle) {
        throw new NotFoundException('vehicle_not_found');
      }
      if (nextPlannedSeats > vehicle.seats) {
        throw new BadRequestException('planned_seats_exceed_vehicle_capacity');
      }
    }

    const reservedSeatsRaw =
      dto.reservedSeats !== undefined ? dto.reservedSeats : schedule.reservedSeats;
    const nextReservedSeats = Number(reservedSeatsRaw);
    if (!Number.isFinite(nextReservedSeats) || nextReservedSeats < 0) {
      throw new BadRequestException('invalid_reserved_seats');
    }
    if (nextReservedSeats > nextPlannedSeats) {
      throw new BadRequestException('reserved_seats_exceed_planned');
    }

    if (dto.pricePerSeat !== undefined) {
      const nextPrice = Number(dto.pricePerSeat);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        throw new BadRequestException('invalid_price_per_seat');
      }
      schedule.pricePerSeat = nextPrice;
    }

    if (dto.recurrence !== undefined) schedule.recurrence = dto.recurrence;
    if (dto.notes !== undefined) schedule.notes = dto.notes?.trim() || null;
    if (dto.metadata !== undefined) schedule.metadata = dto.metadata ?? null;
    if (dto.status !== undefined) schedule.status = dto.status;

    schedule.departureAt = nextDeparture;
    schedule.arrivalEstimate = nextArrival;
    schedule.plannedSeats = nextPlannedSeats;
    schedule.reservedSeats = nextReservedSeats;

    const saved = await this.schedules.save(schedule);
    this.queueRefresh();
    return saved;
  }

  @Delete(':vehicleId/schedules/:scheduleId')
  async cancelSchedule(
    @Param('companyId') companyId: string,
    @Param('vehicleId') vehicleId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    const schedule = await this.schedules.findOne({
      where: { id: scheduleId, vehicleId, companyId },
    });
    if (!schedule) {
      throw new NotFoundException('schedule_not_found');
    }
    schedule.status = 'CANCELLED';
    const saved = await this.schedules.save(schedule);
    this.queueRefresh();
    return saved;
  }
}
