import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddPaymentCore1769014000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_intents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'booking_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'payer_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '8',
            default: "'XOF'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            default: "'PENDING'",
          },
          {
            name: 'payment_method_type',
            type: 'varchar',
            length: '32',
            isNullable: true,
          },
          {
            name: 'payment_method_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'payment_provider',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'refunded_amount',
            type: 'int',
            default: '0',
          },
          {
            name: 'captured_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'refunded_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_payment_intent_booking', columnNames: ['booking_id'], isUnique: true },
          { name: 'idx_payment_intent_payer', columnNames: ['payer_id'] },
          { name: 'idx_payment_intent_status', columnNames: ['status'] },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'payment_idempotency_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'request_hash',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_payment_idempotency_key', columnNames: ['idempotency_key'], isUnique: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'payment_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'event_id',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'processed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_payment_event_id', columnNames: ['event_id'], isUnique: true },
          { name: 'idx_payment_event_type', columnNames: ['type'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_events');
    await queryRunner.dropTable('payment_idempotency_keys');
    await queryRunner.dropTable('payment_intents');
  }
}
