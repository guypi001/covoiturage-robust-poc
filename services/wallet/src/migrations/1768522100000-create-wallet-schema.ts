import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletSchema1768522100000 implements MigrationInterface {
  name = 'CreateWalletSchema1768522100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TABLE "wallets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" character varying NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallets_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query('CREATE INDEX "IDX_wallets_owner_id" ON "wallets" ("ownerId")');
    await queryRunner.query(
      `CREATE TABLE "holds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" character varying NOT NULL,
        "referenceId" character varying NOT NULL,
        "amount" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'HELD',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_holds_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query('CREATE INDEX "IDX_holds_owner_id" ON "holds" ("ownerId")');
    await queryRunner.query('CREATE INDEX "IDX_holds_reference_id" ON "holds" ("referenceId")');
    await queryRunner.query('CREATE INDEX "IDX_holds_status" ON "holds" ("status")');
    await queryRunner.query(
      `CREATE TABLE "payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" character varying NOT NULL,
        "type" character varying(32) NOT NULL,
        "label" character varying(160),
        "provider" character varying(64),
        "last4" character varying(8),
        "expiresAt" character varying(16),
        "phoneNumber" character varying(32),
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_methods_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query('CREATE INDEX "IDX_payment_methods_owner_id" ON "payment_methods" ("ownerId")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_payment_methods_owner_id"');
    await queryRunner.query('DROP TABLE "payment_methods"');
    await queryRunner.query('DROP INDEX "IDX_holds_status"');
    await queryRunner.query('DROP INDEX "IDX_holds_reference_id"');
    await queryRunner.query('DROP INDEX "IDX_holds_owner_id"');
    await queryRunner.query('DROP TABLE "holds"');
    await queryRunner.query('DROP INDEX "IDX_wallets_owner_id"');
    await queryRunner.query('DROP TABLE "wallets"');
  }
}
