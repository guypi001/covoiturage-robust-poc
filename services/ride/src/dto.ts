import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { ScheduleRecurrence, ScheduleStatus, VehicleStatus } from './entities';

export class CreateRideDto {
  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  driverLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  driverPhotoUrl?: string;

  @IsString()
  originCity!: string;

  @IsString()
  destinationCity!: string;

  @IsDateString()
  departureAt!: string;

  @IsInt()
  @Min(1)
  seatsTotal!: number;

  @IsInt()
  @Min(0)
  pricePerSeat!: number;
}

export class AdminUpdateRideDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  originCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destinationCity?: string;

  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatsTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  seatsAvailable?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerSeat?: number;

  @IsOptional()
  @IsIn(['PUBLISHED', 'CLOSED'] as const)
  status?: 'PUBLISHED' | 'CLOSED';
}

export class CreateVehicleDto {
  @IsString()
  @MaxLength(160)
  label!: string;

  @IsString()
  @MaxLength(32)
  plateNumber!: string;

  @IsString()
  @MaxLength(32)
  category!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  seats!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  year?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsObject()
  specs?: Record<string, any>;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  seats?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  year?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsObject()
  specs?: Record<string, any>;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'] satisfies VehicleStatus[])
  status?: VehicleStatus;
}

export class CreateScheduleDto {
  @IsString()
  @MaxLength(160)
  originCity!: string;

  @IsString()
  @MaxLength(160)
  destinationCity!: string;

  @IsDateString()
  departureAt!: string;

  @IsOptional()
  @IsDateString()
  arrivalEstimate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  plannedSeats?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerSeat?: number;

  @IsOptional()
  @IsIn(['NONE', 'DAILY', 'WEEKLY'] satisfies ScheduleRecurrence[])
  recurrence?: ScheduleRecurrence;

  @IsOptional()
  @MaxLength(512)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  originCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destinationCity?: string;

  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @IsOptional()
  @IsDateString()
  arrivalEstimate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  plannedSeats?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerSeat?: number;

  @IsOptional()
  @IsIn(['NONE', 'DAILY', 'WEEKLY'] satisfies ScheduleRecurrence[])
  recurrence?: ScheduleRecurrence;

  @IsOptional()
  @MaxLength(512)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsIn(['PLANNED', 'COMPLETED', 'CANCELLED'] satisfies ScheduleStatus[])
  status?: ScheduleStatus;

  @ValidateIf((o) => o.status === 'COMPLETED')
  @IsOptional()
  @IsInt()
  @Min(0)
  reservedSeats?: number;
}
