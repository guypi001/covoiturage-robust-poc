import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddRatings1769022100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('ratings');
    if (hasTable) return;
    await queryRunner.createTable(
      new Table({
        name: 'ratings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'booking_id', type: 'uuid', isNullable: false },
          { name: 'ride_id', type: 'varchar', length: '64', isNullable: false },
          { name: 'rater_id', type: 'uuid', isNullable: false },
          { name: 'ratee_id', type: 'uuid', isNullable: false },
          { name: 'rater_role', type: 'varchar', length: '16', isNullable: false },
          { name: 'punctuality', type: 'int', isNullable: false },
          { name: 'driving', type: 'int', isNullable: false },
          { name: 'cleanliness', type: 'int', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'ratings',
      new TableIndex({
        name: 'idx_ratings_booking_rater',
        columnNames: ['booking_id', 'rater_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'ratings',
      new TableIndex({
        name: 'idx_ratings_ratee_created',
        columnNames: ['ratee_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'ratings',
      new TableIndex({
        name: 'idx_ratings_ride_created',
        columnNames: ['ride_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('ratings');
    if (!hasTable) return;
    await queryRunner.dropTable('ratings');
  }
}
