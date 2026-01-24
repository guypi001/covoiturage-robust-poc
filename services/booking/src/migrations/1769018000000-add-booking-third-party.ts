import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingThirdParty1769018000000 implements MigrationInterface {
  name = 'AddBookingThirdParty1769018000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "passenger_name" varchar(160)',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "passenger_email" varchar(200)',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "passenger_phone" varchar(40)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "passenger_phone"');
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "passenger_email"');
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "passenger_name"');
  }
}
