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

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'login_count', type: 'int', default: 0 })
  loginCount!: number;

  @Column({ name: 'profile_photo_url', type: 'text', nullable: true })
  profilePhotoUrl?: string | null;

  @Column({ name: 'home_preferences', type: 'jsonb', nullable: true })
  homePreferences?: HomePreferences | null;

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
