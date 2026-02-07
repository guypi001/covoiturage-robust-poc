import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfileAnswers1769022000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('accounts', 'profile_answers');
    if (hasColumn) return;
    await queryRunner.addColumn(
      'accounts',
      new TableColumn({
        name: 'profile_answers',
        type: 'jsonb',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('accounts', 'profile_answers');
    if (!hasColumn) return;
    await queryRunner.dropColumn('accounts', 'profile_answers');
  }
}
