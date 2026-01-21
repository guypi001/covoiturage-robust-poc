import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddWalletBalance1769014300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallets" ADD COLUMN "balance" int NOT NULL DEFAULT 0`);

    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'ownerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'referenceId',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          { name: 'idx_wallet_tx_owner', columnNames: ['ownerId'] },
          { name: 'idx_wallet_tx_reference', columnNames: ['referenceId'] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wallet_transactions');
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "balance"`);
  }
}
