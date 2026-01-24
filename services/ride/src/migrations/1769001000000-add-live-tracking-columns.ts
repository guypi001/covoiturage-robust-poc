import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLiveTrackingColumns1769001000000 implements MigrationInterface {
  name = 'AddLiveTrackingColumns1769001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "live_tracking_enabled" boolean',
    );
    await queryRunner.query(
      'UPDATE "rides" SET "live_tracking_enabled" = false WHERE "live_tracking_enabled" IS NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "rides" ALTER COLUMN "live_tracking_enabled" SET DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "rides" ALTER COLUMN "live_tracking_enabled" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "rides" ADD COLUMN IF NOT EXISTS "live_tracking_mode" varchar(32)',
    );
    await queryRunner.query(
      "UPDATE \"rides\" SET \"live_tracking_mode\" = 'FULL' WHERE \"live_tracking_mode\" IS NULL",
    );
    await queryRunner.query(
      "ALTER TABLE \"rides\" ALTER COLUMN \"live_tracking_mode\" SET DEFAULT 'FULL'",
    );
    await queryRunner.query(
      'ALTER TABLE "rides" ALTER COLUMN "live_tracking_mode" SET NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "rides" DROP COLUMN "live_tracking_mode"');
    await queryRunner.query('ALTER TABLE "rides" DROP COLUMN "live_tracking_enabled"');
  }
}
