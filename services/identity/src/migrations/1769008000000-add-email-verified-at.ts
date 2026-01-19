import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailVerifiedAt1769008000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'accounts',
      new TableColumn({
        name: 'email_verified_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('accounts', 'email_verified_at');
  }
}
