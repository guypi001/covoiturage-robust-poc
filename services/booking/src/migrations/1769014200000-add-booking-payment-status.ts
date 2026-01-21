import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingPaymentStatus1769014200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "payment_status" varchar(16) NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "payment_error" varchar(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN "payment_refunded_amount" int NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "payment_refunded_amount"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "payment_error"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "payment_status"`);
  }
}
