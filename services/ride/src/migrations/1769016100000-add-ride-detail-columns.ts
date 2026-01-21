import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRideDetailColumns1769016100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('rides', [
      new TableColumn({
        name: 'driver_email_verified',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'driver_phone_verified',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'driver_verified',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'comfort_level',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
      new TableColumn({
        name: 'estimated_duration_minutes',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'stops',
        type: 'text',
        isArray: true,
        isNullable: true,
      }),
      new TableColumn({
        name: 'cancelled_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'cancellation_reason',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rides', 'cancellation_reason');
    await queryRunner.dropColumn('rides', 'cancelled_at');
    await queryRunner.dropColumn('rides', 'stops');
    await queryRunner.dropColumn('rides', 'estimated_duration_minutes');
    await queryRunner.dropColumn('rides', 'comfort_level');
    await queryRunner.dropColumn('rides', 'driver_verified');
    await queryRunner.dropColumn('rides', 'driver_phone_verified');
    await queryRunner.dropColumn('rides', 'driver_email_verified');
  }
}
