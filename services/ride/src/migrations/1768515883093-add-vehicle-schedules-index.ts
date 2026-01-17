import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleSchedulesIndex1768515883093 implements MigrationInterface {
  name = 'AddVehicleSchedulesIndex1768515883093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "idx_vehicle_schedules_vehicle_status_departure" ON "vehicle_schedules" ("vehicle_id", "status", "departureAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "idx_vehicle_schedules_vehicle_status_departure"',
    );
  }
}
