import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddCompanyPoliciesApprovals1769017000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'company_policies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'max_price_per_seat',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'allowed_origins',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'allowed_destinations',
            type: 'text',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'blackout_windows',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'require_approval',
            type: 'boolean',
            default: false,
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
        indices: [{ name: 'idx_company_policy_company', columnNames: ['company_id'], isUnique: true }],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'schedule_approvals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'schedule_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            default: "'PENDING'",
          },
          {
            name: 'requested_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'decided_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'decided_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'schedule_approvals',
      new TableIndex({
        name: 'idx_schedule_approvals_company_schedule',
        columnNames: ['company_id', 'schedule_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('schedule_approvals', 'idx_schedule_approvals_company_schedule');
    await queryRunner.dropTable('schedule_approvals');
    await queryRunner.dropTable('company_policies');
  }
}
