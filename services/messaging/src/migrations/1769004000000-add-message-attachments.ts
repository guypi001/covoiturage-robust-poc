import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachments1769004000000 implements MigrationInterface {
  name = 'AddMessageAttachments1769004000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN "attachment_url" varchar');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN "attachment_name" varchar');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN "attachment_type" varchar');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN "delivered_at" timestamptz');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN "delivered_at"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN "attachment_type"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN "attachment_name"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN "attachment_url"');
  }
}
