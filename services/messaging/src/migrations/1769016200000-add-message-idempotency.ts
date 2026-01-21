import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddMessageIdempotency1769016200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('messages', [
      new TableColumn({
        name: 'client_message_id',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'message_type',
        type: 'varchar',
        length: '16',
        default: "'USER'",
      }),
    ]);

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'idx_messages_client_id',
        columnNames: ['client_message_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('messages', 'idx_messages_client_id');
    await queryRunner.dropColumn('messages', 'message_type');
    await queryRunner.dropColumn('messages', 'client_message_id');
  }
}
