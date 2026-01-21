import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddCompanyVerification1769017100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'accounts',
      new TableColumn({
        name: 'company_verified_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'company_documents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'account_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'file_url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            default: "'PENDING'",
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_company_doc_account', columnNames: ['account_id'] },
          { name: 'idx_company_doc_type', columnNames: ['type'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('company_documents');
    await queryRunner.dropColumn('accounts', 'company_verified_at');
  }
}
