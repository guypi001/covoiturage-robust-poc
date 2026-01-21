import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

@Entity('payment_intents')
export class PaymentIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @Index()
  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId?: string | null;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 8, default: 'XOF' })
  currency!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: PaymentStatus;

  @Column({ name: 'payment_method_type', type: 'varchar', length: 32, nullable: true })
  paymentMethodType?: string | null;

  @Column({ name: 'payment_method_id', type: 'varchar', length: 64, nullable: true })
  paymentMethodId?: string | null;

  @Column({ name: 'payment_provider', type: 'varchar', length: 64, nullable: true })
  paymentProvider?: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, nullable: true })
  idempotencyKey?: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 128, nullable: true })
  failureReason?: string | null;

  @Column({ name: 'refunded_amount', type: 'int', default: 0 })
  refundedAmount!: number;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt?: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('payment_idempotency_keys')
export class PaymentIdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 128 })
  requestHash!: string;

  @Column({ name: 'response', type: 'jsonb', nullable: true })
  response?: Record<string, any> | null;

  @Column({ name: 'status', type: 'varchar', length: 32, nullable: true })
  status?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('payment_events')
export class PaymentEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'varchar', length: 128 })
  eventId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
