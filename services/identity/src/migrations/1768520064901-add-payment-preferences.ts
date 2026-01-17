import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentPreferences1768520064901 implements MigrationInterface {
  name = 'AddPaymentPreferences1768520064901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "accounts" ADD COLUMN "payment_preferences" jsonb',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "accounts" DROP COLUMN "payment_preferences"',
    );
  }
}
