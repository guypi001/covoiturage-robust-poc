import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddSavedSearches1769016000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'saved_searches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'account_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'origin_city',
            type: 'varchar',
            length: '160',
            isNullable: false,
          },
          {
            name: 'destination_city',
            type: 'varchar',
            length: '160',
            isNullable: false,
          },
          {
            name: 'date',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'seats',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'price_max',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'departure_after',
            type: 'varchar',
            length: '8',
            isNullable: true,
          },
          {
            name: 'departure_before',
            type: 'varchar',
            length: '8',
            isNullable: true,
          },
          {
            name: 'live_tracking',
            type: 'boolean',
            default: false,
          },
          {
            name: 'comfort_level',
            type: 'varchar',
            length: '32',
            isNullable: true,
          },
          {
            name: 'driver_verified',
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
        indices: [
          { name: 'idx_saved_search_account', columnNames: ['account_id'] },
          { name: 'idx_saved_search_route', columnNames: ['origin_city', 'destination_city'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('saved_searches');
  }
}
