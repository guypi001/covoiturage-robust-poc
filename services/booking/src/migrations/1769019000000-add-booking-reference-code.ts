import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingReferenceCode1769019000000 implements MigrationInterface {
  name = 'AddBookingReferenceCode1769019000000';

  private generateCode(existing: Set<string>) {
    let attempts = 0;
    while (attempts < 20) {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      if (!existing.has(code)) return code;
      attempts += 1;
    }
    const fallback = String(Date.now()).slice(-8);
    return existing.has(fallback) ? `${Math.floor(Math.random() * 1e8)}`.padStart(8, '0') : fallback;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "bookings" ADD COLUMN "reference_code" varchar(8)');

    const existing = await queryRunner.query(
      'SELECT "reference_code" FROM "bookings" WHERE "reference_code" IS NOT NULL',
    );
    const used = new Set<string>(existing.map((row: any) => String(row.reference_code)));

    const rows = await queryRunner.query('SELECT "id" FROM "bookings" WHERE "reference_code" IS NULL');
    for (const row of rows) {
      const code = this.generateCode(used);
      used.add(code);
      await queryRunner.query('UPDATE "bookings" SET "reference_code" = $1 WHERE "id" = $2', [
        code,
        row.id,
      ]);
    }

    await queryRunner.query('ALTER TABLE "bookings" ALTER COLUMN "reference_code" SET NOT NULL');
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_bookings_reference_code" ON "bookings" ("reference_code")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_bookings_reference_code"');
    await queryRunner.query('ALTER TABLE "bookings" DROP COLUMN "reference_code"');
  }
}
