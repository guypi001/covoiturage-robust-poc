// services/booking/src/entities/booking.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

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
  @CreateDateColumn() createdAt!: Date;
}
