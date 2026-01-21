// services/booking/src/entities/booking.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
export type PaymentMethodType = 'CARD' | 'MOBILE_MONEY' | 'CASH';

@Entity('bookings')
@Index(['rideId', 'createdAt'])
@Index(['passengerId', 'status', 'createdAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column() rideId!: string;
  @Column() passengerId!: string;

  @Column('int') seats!: number;
  @Column('int') amount!: number;

  // 👇 colonne SQL 'hold_id', propriété TS 'holdId'
  // Si l'ID du hold n’est pas un UUID, remplace 'uuid' par 'varchar'
  @Column({ name: 'hold_id', type: 'uuid', nullable: true })
  holdId!: string | null;

  @Column({ default: 'PENDING' }) status!: BookingStatus;

  @Column({ name: 'payment_method', type: 'varchar', length: 32, nullable: true })
  paymentMethod?: PaymentMethodType | null;

  @Column({ name: 'payment_provider', type: 'varchar', length: 64, nullable: true })
  paymentProvider?: string | null;

  @Column({ name: 'payment_method_id', type: 'varchar', length: 64, nullable: true })
  paymentMethodId?: string | null;

  @Column({ name: 'payment_status', type: 'varchar', length: 16, default: 'PENDING' })
  paymentStatus!: PaymentStatus;

  @Column({ name: 'payment_error', type: 'varchar', length: 160, nullable: true })
  paymentError?: string | null;

  @Column({ name: 'payment_refunded_amount', type: 'int', default: 0 })
  paymentRefundedAmount!: number;

  @CreateDateColumn() createdAt!: Date;
}
