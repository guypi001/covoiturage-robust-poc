import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AccountType = 'INDIVIDUAL' | 'COMPANY';
export type AccountRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type HomePreferences = {
  favoriteRoutes?: Array<{ from: string; to: string }>;
  quickActions?: string[];
  theme?: 'default' | 'sunset' | 'night';
  heroMessage?: string;
  showTips?: boolean;
};

export type PaymentPreferences = {
  defaultPaymentMethodId?: string;
};

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: AccountType;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName?: string | null;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName?: string | null;

  @Column({ name: 'registration_number', type: 'varchar', length: 64, nullable: true })
  registrationNumber?: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 255, nullable: true })
  contactName?: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone?: string | null;

  @Column({ name: 'comfort_preferences', type: 'text', array: true, nullable: true })
  comfortPreferences?: string[] | null;

  @Column({ name: 'tagline', type: 'text', nullable: true })
  tagline?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  role!: AccountRole;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: AccountStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'login_count', type: 'int', default: 0 })
  loginCount!: number;

  @Column({ name: 'profile_photo_url', type: 'text', nullable: true })
  profilePhotoUrl?: string | null;

  @Column({ name: 'home_preferences', type: 'jsonb', nullable: true })
  homePreferences?: HomePreferences | null;

  @Column({ name: 'payment_preferences', type: 'jsonb', nullable: true })
  paymentPreferences?: PaymentPreferences | null;

  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('otp_tokens')
export class OtpToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  email!: string;

  @Column({ name: 'code_hash' })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('phone_otp_tokens')
export class PhoneOtpToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ name: 'code_hash' })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'secret_hash', type: 'text' })
  secretHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type ReportCategory = 'ACCOUNT' | 'RIDE' | 'BOOKING' | 'MESSAGE' | 'OTHER';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId!: string;

  @Index()
  @Column({ name: 'target_account_id', type: 'uuid', nullable: true })
  targetAccountId?: string | null;

  @Index()
  @Column({ name: 'target_ride_id', type: 'varchar', length: 64, nullable: true })
  targetRideId?: string | null;

  @Index()
  @Column({ name: 'target_booking_id', type: 'varchar', length: 64, nullable: true })
  targetBookingId?: string | null;

  @Column({ type: 'varchar', length: 20 })
  category!: ReportCategory;

  @Column({ type: 'varchar', length: 64 })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('saved_searches')
@Index(['accountId', 'originCity', 'destinationCity'])
export class SavedSearch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'origin_city', type: 'varchar', length: 160 })
  originCity!: string;

  @Column({ name: 'destination_city', type: 'varchar', length: 160 })
  destinationCity!: string;

  @Column({ name: 'date', type: 'timestamptz', nullable: true })
  date?: Date | null;

  @Column({ name: 'seats', type: 'int', nullable: true })
  seats?: number | null;

  @Column({ name: 'price_max', type: 'int', nullable: true })
  priceMax?: number | null;

  @Column({ name: 'departure_after', type: 'varchar', length: 8, nullable: true })
  departureAfter?: string | null;

  @Column({ name: 'departure_before', type: 'varchar', length: 8, nullable: true })
  departureBefore?: string | null;

  @Column({ name: 'live_tracking', type: 'boolean', default: false })
  liveTracking!: boolean;

  @Column({ name: 'comfort_level', type: 'varchar', length: 32, nullable: true })
  comfortLevel?: string | null;

  @Column({ name: 'driver_verified', type: 'boolean', default: false })
  driverVerified!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
