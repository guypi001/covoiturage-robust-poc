import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddPhoneVerification1769008200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'accounts',
      new TableColumn({
        name: 'phone_verified_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'phone_otp_tokens',
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
            name: 'phone',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'code_hash',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'attempts',
            type: 'int',
            default: '0',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_phone_otp_account', columnNames: ['account_id'] },
          { name: 'idx_phone_otp_phone', columnNames: ['phone'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('phone_otp_tokens');
    await queryRunner.dropColumn('accounts', 'phone_verified_at');
  }
}
