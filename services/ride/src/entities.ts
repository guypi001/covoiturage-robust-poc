import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RideStatus = 'PUBLISHED' | 'CLOSED';
export type LiveTrackingMode = 'FULL' | 'CITY_ALERTS';
export type VehicleStatus = 'ACTIVE' | 'INACTIVE';
export type ScheduleStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';
export type ScheduleRecurrence = 'NONE' | 'DAILY' | 'WEEKLY';

@Entity('rides')
@Index(['driverId', 'status', 'departureAt'])
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  driverId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  driverLabel?: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  driverPhotoUrl?: string | null;

  @Column({ name: 'driver_email_verified', type: 'boolean', default: false })
  driverEmailVerified!: boolean;

  @Column({ name: 'driver_phone_verified', type: 'boolean', default: false })
  driverPhoneVerified!: boolean;

  @Column({ name: 'driver_verified', type: 'boolean', default: false })
  driverVerified!: boolean;

  @Column({ name: 'comfort_level', type: 'varchar', length: 32, nullable: true })
  comfortLevel?: string | null;

  @Column({ name: 'estimated_duration_minutes', type: 'int', nullable: true })
  estimatedDurationMinutes?: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  stops?: string[] | null;

  @Column()
  originCity!: string;

  @Column()
  destinationCity!: string;

  @Column()
  departureAt!: string;

  @Column('int')
  seatsTotal!: number;

  @Column('int')
  seatsAvailable!: number;

  @Column('int')
  pricePerSeat!: number;

  @Index()
  @Column({ default: 'PUBLISHED' })
  status!: RideStatus;

  @Column({ type: 'boolean', default: false, name: 'live_tracking_enabled' })
  liveTrackingEnabled!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'FULL', name: 'live_tracking_mode' })
  liveTrackingMode!: LiveTrackingMode;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('fleet_vehicles')
export class FleetVehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId!: string;

  @Column({ type: 'varchar', length: 160 })
  label!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  plateNumber!: string;

  @Column({ type: 'varchar', length: 32, default: 'MINIBUS' })
  category!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model?: string | null;

  @Column({ type: 'int' })
  seats!: number;

  @Column({ type: 'int', nullable: true })
  year?: number | null;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: VehicleStatus;

  @Column({ type: 'text', array: true, nullable: true })
  amenities?: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  specs?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('vehicle_schedules')
@Index('idx_vehicle_schedules_vehicle_status_departure', [
  'vehicleId',
  'status',
  'departureAt',
])
export class VehicleSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  companyId!: string;

  @Index()
  @Column({ name: 'vehicle_id' })
  vehicleId!: string;

  @ManyToOne(() => FleetVehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: FleetVehicle;

  @Column({ type: 'varchar', length: 160 })
  originCity!: string;

  @Column({ type: 'varchar', length: 160 })
  destinationCity!: string;

  @Column({ type: 'timestamptz' })
  departureAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  arrivalEstimate?: Date | null;

  @Column({ type: 'int' })
  plannedSeats!: number;

  @Column({ type: 'int', default: 0 })
  reservedSeats!: number;

  @Column({ type: 'int', default: 0 })
  pricePerSeat!: number;

  @Column({ type: 'varchar', length: 16, default: 'NONE' })
  recurrence!: ScheduleRecurrence;

  @Column({ type: 'varchar', length: 16, default: 'PLANNED' })
  status!: ScheduleStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('outbox')
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  topic!: string;

  @Column('jsonb')
  payload!: any;

  @Column({ default: false })
  sent!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
