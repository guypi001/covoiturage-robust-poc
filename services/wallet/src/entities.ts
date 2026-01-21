import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, UpdateDateColumn } from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  ownerId!: string;

  @Column({ type: 'int', default: 0 })
  balance!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  ownerId!: string;

  @Index()
  @Column()
  referenceId!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: 'CREDIT' | 'DEBIT';

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reason?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('holds')
export class Hold {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  ownerId!: string;

  @Index()
  @Column()
  referenceId!: string;

  @Column('int')
  amount!: number;

  @Index()
  @Column({ default: 'HELD' })
  status!: 'HELD' | 'CAPTURED' | 'RELEASED';

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  ownerId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: 'CARD' | 'MOBILE_MONEY' | 'CASH';

  @Column({ type: 'varchar', length: 160, nullable: true })
  label?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  provider?: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  last4?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  expiresAt?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
