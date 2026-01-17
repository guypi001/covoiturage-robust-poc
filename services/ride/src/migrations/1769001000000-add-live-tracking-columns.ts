import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLiveTrackingColumns1769001000000 implements MigrationInterface {
  name = 'AddLiveTrackingColumns1769001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "rides" ADD COLUMN "live_tracking_enabled" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "rides" ADD COLUMN "live_tracking_mode" varchar(32) NOT NULL DEFAULT \"FULL\"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "rides" DROP COLUMN "live_tracking_mode"');
    await queryRunner.query('ALTER TABLE "rides" DROP COLUMN "live_tracking_enabled"');
  }
}
