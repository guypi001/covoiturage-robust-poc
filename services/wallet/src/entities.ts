import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
@Entity('wallets') export class Wallet { @PrimaryGeneratedColumn('uuid') id!: string; @Index() @Column() ownerId!: string; @CreateDateColumn() createdAt!: Date; }
@Entity('holds') export class Hold { @PrimaryGeneratedColumn('uuid') id!: string; @Index() @Column() ownerId!: string; @Index() @Column() referenceId!: string;
  @Column('int') amount!: number; @Index() @Column({ default:'HELD' }) status!: 'HELD'|'CAPTURED'|'RELEASED'; @CreateDateColumn() createdAt!: Date; }
