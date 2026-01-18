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
    const now = new Date();

    if (vehicleIds.length > 0) {
      const ensureEntry = (vehicleId: string) => {
        const existing = upcomingByVehicle.get(vehicleId);
        if (existing) return existing;
        const entry = { count: 0, nextDeparture: null, samples: [] as VehicleSchedule[] };
        upcomingByVehicle.set(vehicleId, entry);
        return entry;
      };

      const upcomingStats = await this.schedules
        .createQueryBuilder('schedule')
        .select('schedule.vehicleId', 'vehicleId')
        .addSelect('COUNT(*)::int', 'count')
        .addSelect('MIN(schedule.departureAt)', 'nextDepartureAt')
        .where('schedule.companyId = :companyId', { companyId })
        .andWhere('schedule.vehicleId IN (:...vehicleIds)', { vehicleIds })
        .andWhere('schedule.status = :status', { status: 'PLANNED' })
        .andWhere('schedule.departureAt > :now', { now })
        .groupBy('schedule.vehicleId')
        .getRawMany<{ vehicleId: string; count: string; nextDepartureAt: string | Date }>();

      for (const row of upcomingStats) {
        const entry = ensureEntry(row.vehicleId);
        entry.count = Number.parseInt(String(row.count ?? 0), 10);
        entry.nextDeparture = row.nextDepartureAt ? new Date(row.nextDepartureAt) : null;
      }

      const upcomingSamples = await this.schedules
        .createQueryBuilder()
        .select('*')
        .from(
          (subQb) =>
            subQb
              .select([
                'schedule.id AS id',
                'schedule.companyId AS company_id',
                'schedule.vehicleId AS vehicle_id',
                'schedule.originCity AS origin_city',
                'schedule.destinationCity AS destination_city',
                'schedule.departureAt AS departure_at',
                'schedule.arrivalEstimate AS arrival_estimate',
                'schedule.plannedSeats::int AS planned_seats',
                'schedule.reservedSeats::int AS reserved_seats',
                'schedule.pricePerSeat::int AS price_per_seat',
                'schedule.recurrence AS recurrence',
                'schedule.status AS status',
                'schedule.notes AS notes',
                'schedule.metadata AS metadata',
                'schedule.createdAt AS created_at',
                'schedule.updatedAt AS updated_at',
              ])
              .addSelect(
                'ROW_NUMBER() OVER (PARTITION BY schedule.vehicleId ORDER BY schedule.departureAt ASC)',
                'row_num',
              )
              .from(VehicleSchedule, 'schedule')
              .where('schedule.companyId = :companyId', { companyId })
              .andWhere('schedule.vehicleId IN (:...vehicleIds)', { vehicleIds })
              .andWhere('schedule.status = :status', { status: 'PLANNED' })
              .andWhere('schedule.departureAt > :now', { now }),
          'ranked',
        )
        .where('row_num <= 3')
        .orderBy('vehicle_id', 'ASC')
        .addOrderBy('departure_at', 'ASC')
        .getRawMany<{
          id: string;
          company_id: string;
          vehicle_id: string;
          origin_city: string;
          destination_city: string;
          departure_at: Date;
          arrival_estimate: Date | null;
          planned_seats: number;
          reserved_seats: number;
          price_per_seat: number;
          recurrence: string;
          status: string;
          notes: string | null;
          metadata: Record<string, any> | null;
          created_at: Date;
          updated_at: Date;
          row_num: number;
        }>();

      for (const row of upcomingSamples) {
        const entry = ensureEntry(row.vehicle_id);
        const schedule = this.schedules.create();
        Object.assign(schedule, {
          id: row.id,
          companyId: row.company_id,
          vehicleId: row.vehicle_id,
          originCity: row.origin_city,
          destinationCity: row.destination_city,
          departureAt: row.departure_at,
          arrivalEstimate: row.arrival_estimate,
          plannedSeats: row.planned_seats,
          reservedSeats: row.reserved_seats,
          pricePerSeat: row.price_per_seat,
          recurrence: row.recurrence,
          status: row.status,
          notes: row.notes,
          metadata: row.metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
        entry.samples.push(schedule);
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
          departureAt: MoreThan(now),
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
    const existing = await this.vehicles.findOne({
      where: { plateNumber: plate, companyId },
    });
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

    const summaryQb = this.schedules
      .createQueryBuilder('schedule')
      .select('schedule.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('schedule.companyId = :companyId', { companyId })
      .andWhere('schedule.vehicleId = :vehicleId', { vehicleId });

    if (query.status && query.status !== 'ALL') {
      summaryQb.andWhere('schedule.status = :status', { status: query.status });
    }

    if (query.window === 'upcoming') {
      summaryQb.andWhere('schedule.departureAt >= :now', { now });
    } else if (query.window === 'past') {
      summaryQb.andWhere('schedule.departureAt < :now', { now });
    }

    const summary = await summaryQb
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
