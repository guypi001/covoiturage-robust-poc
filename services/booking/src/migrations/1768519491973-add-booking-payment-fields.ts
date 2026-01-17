import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingPaymentFields1768519491973 implements MigrationInterface {
  name = 'AddBookingPaymentFields1768519491973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "payment_method" varchar(32)',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "payment_provider" varchar(64)',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "payment_method_id" varchar(64)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "payment_method_id"');
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "payment_provider"');
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "payment_method"');
  }
}
