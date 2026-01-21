import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddReports1769012200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'reporter_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'target_account_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'target_ride_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'target_booking_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_report_reporter', columnNames: ['reporter_id'] },
          { name: 'idx_report_target_account', columnNames: ['target_account_id'] },
          { name: 'idx_report_target_ride', columnNames: ['target_ride_id'] },
          { name: 'idx_report_target_booking', columnNames: ['target_booking_id'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reports');
  }
}
