import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyPolicy, FleetVehicle, ScheduleApproval, VehicleSchedule } from './entities';
import { InternalGuard } from './internal.guard';

type PolicyUpdateDto = {
  maxPricePerSeat?: number | null;
  allowedOrigins?: string[];
  allowedDestinations?: string[];
  blackoutWindows?: Array<{ days?: number[]; start: string; end: string }>;
  requireApproval?: boolean;
};

type ApprovalDto = {
  actorId?: string;
  note?: string;
};

type AutoAssignDto = {
  originCity: string;
  destinationCity: string;
  departureAt: string;
  plannedSeats: number;
  pricePerSeat?: number;
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY';
};

@Controller('admin/companies/:companyId')
@UseGuards(InternalGuard)
export class CompanyOpsController {
  constructor(
    @InjectRepository(CompanyPolicy)
    private readonly policies: Repository<CompanyPolicy>,
    @InjectRepository(VehicleSchedule)
    private readonly schedules: Repository<VehicleSchedule>,
    @InjectRepository(ScheduleApproval)
    private readonly approvals: Repository<ScheduleApproval>,
    @InjectRepository(FleetVehicle)
    private readonly vehicles: Repository<FleetVehicle>,
  ) {}

  @Get('policy')
  async getPolicy(@Param('companyId') companyId: string) {
    const policy = await this.policies.findOne({ where: { companyId } });
    return policy ?? { companyId, requireApproval: false };
  }

  @Patch('policy')
  async updatePolicy(@Param('companyId') companyId: string, @Body() dto: PolicyUpdateDto) {
    let policy = await this.policies.findOne({ where: { companyId } });
    if (!policy) {
      policy = this.policies.create({ companyId });
    }
    if (dto.maxPricePerSeat !== undefined) {
      policy.maxPricePerSeat = dto.maxPricePerSeat ?? null;
    }
    if (dto.allowedOrigins !== undefined) {
      policy.allowedOrigins = dto.allowedOrigins?.map((c) => c.trim()).filter(Boolean) ?? null;
    }
    if (dto.allowedDestinations !== undefined) {
      policy.allowedDestinations = dto.allowedDestinations?.map((c) => c.trim()).filter(Boolean) ?? null;
    }
    if (dto.blackoutWindows !== undefined) {
      policy.blackoutWindows = dto.blackoutWindows ?? null;
    }
    if (dto.requireApproval !== undefined) {
      policy.requireApproval = Boolean(dto.requireApproval);
    }
    return this.policies.save(policy);
  }

  @Post('schedules/:scheduleId/approve')
  async approveSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: ApprovalDto,
  ) {
    const schedule = await this.schedules.findOne({ where: { id: scheduleId, companyId } });
    if (!schedule) throw new NotFoundException('schedule_not_found');

    let approval = await this.approvals.findOne({ where: { companyId, scheduleId } });
    if (!approval) {
      approval = this.approvals.create({ companyId, scheduleId, requestedBy: dto.actorId ?? null });
    }
    approval.status = 'APPROVED';
    approval.decidedBy = dto.actorId ?? null;
    approval.note = dto.note?.trim() || null;
    approval.decidedAt = new Date();
    await this.approvals.save(approval);

    schedule.status = 'PLANNED';
    await this.schedules.save(schedule);
    return { ok: true, schedule, approval };
  }

  @Post('schedules/:scheduleId/reject')
  async rejectSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: ApprovalDto,
  ) {
    const schedule = await this.schedules.findOne({ where: { id: scheduleId, companyId } });
    if (!schedule) throw new NotFoundException('schedule_not_found');

    let approval = await this.approvals.findOne({ where: { companyId, scheduleId } });
    if (!approval) {
      approval = this.approvals.create({ companyId, scheduleId, requestedBy: dto.actorId ?? null });
    }
    approval.status = 'REJECTED';
    approval.decidedBy = dto.actorId ?? null;
    approval.note = dto.note?.trim() || null;
    approval.decidedAt = new Date();
    await this.approvals.save(approval);

    schedule.status = 'CANCELLED';
    await this.schedules.save(schedule);
    return { ok: true, schedule, approval };
  }

  @Post('schedules/auto-assign')
  async autoAssign(@Param('companyId') companyId: string, @Body() dto: AutoAssignDto) {
    if (!dto.originCity?.trim() || !dto.destinationCity?.trim()) {
      throw new BadRequestException('origin_destination_required');
    }
    const departure = new Date(dto.departureAt);
    if (!Number.isFinite(departure.getTime())) {
      throw new BadRequestException('invalid_departure');
    }
    const plannedSeats = Math.max(1, Number(dto.plannedSeats || 0));
    if (!plannedSeats) throw new BadRequestException('invalid_planned_seats');

    const vehicles = await this.vehicles.find({
      where: { companyId, status: 'ACTIVE' },
      order: { seats: 'ASC' },
    });
    const candidate = vehicles.find((vehicle) => vehicle.seats >= plannedSeats);
    if (!candidate) {
      throw new NotFoundException('no_vehicle_available');
    }

    const schedule = this.schedules.create({
      companyId,
      vehicleId: candidate.id,
      originCity: dto.originCity.trim(),
      destinationCity: dto.destinationCity.trim(),
      departureAt: departure,
      plannedSeats,
      pricePerSeat: dto.pricePerSeat ?? 0,
      recurrence: dto.recurrence ?? 'NONE',
      status: 'PLANNED',
    });
    const saved = await this.schedules.save(schedule);
    return { schedule: saved, vehicle: candidate };
  }

  @Get('dashboard')
  async dashboard(@Param('companyId') companyId: string) {
    const schedules = await this.schedules.find({ where: { companyId } });
    const total = schedules.length;
    const planned = schedules.filter((s) => s.status === 'PLANNED').length;
    const completed = schedules.filter((s) => s.status === 'COMPLETED').length;
    const cancelled = schedules.filter((s) => s.status === 'CANCELLED').length;
    const seatsPlanned = schedules.reduce((acc, s) => acc + (s.plannedSeats || 0), 0);
    const seatsReserved = schedules.reduce((acc, s) => acc + (s.reservedSeats || 0), 0);
    const fillRate = seatsPlanned > 0 ? Math.round((seatsReserved / seatsPlanned) * 100) : 0;

    return { total, planned, completed, cancelled, seatsPlanned, seatsReserved, fillRate };
  }
}
