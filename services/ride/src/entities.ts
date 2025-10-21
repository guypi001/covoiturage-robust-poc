import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';
@Entity('rides') export class Ride {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() driverId!: string; @Column() originCity!: string; @Column() destinationCity!: string;
  @Column() departureAt!: string; @Column('int') seatsTotal!: number; @Column('int') seatsAvailable!: number;
  @Column('int') pricePerSeat!: number; @Index() @Column({ default:'PUBLISHED' }) status!: string; @CreateDateColumn() createdAt!: Date;
}
@Entity('outbox') export class Outbox {
  @PrimaryGeneratedColumn('uuid') id!: string; @Column() topic!: string; @Column('jsonb') payload!: any;
  @Column({ default:false }) sent!: boolean; @CreateDateColumn() createdAt!: Date;
}
