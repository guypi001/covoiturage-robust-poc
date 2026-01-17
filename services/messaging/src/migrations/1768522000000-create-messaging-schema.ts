import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessagingSchema1768522000000 implements MigrationInterface {
  name = 'CreateMessagingSchema1768522000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pairKey" character varying NOT NULL,
        "participantAId" character varying NOT NULL,
        "participantAType" character varying NOT NULL,
        "participantAName" character varying,
        "participantBId" character varying NOT NULL,
        "participantBType" character varying NOT NULL,
        "participantBName" character varying,
        "lastMessageAt" timestamptz,
        "lastMessagePreview" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_conversations_pair_key" ON "conversations" ("pairKey")',
    );
    await queryRunner.query(
      `CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "senderId" character varying NOT NULL,
        "senderType" character varying NOT NULL,
        "senderLabel" character varying,
        "recipientId" character varying NOT NULL,
        "recipientType" character varying NOT NULL,
        "recipientLabel" character varying,
        "body" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'DELIVERED',
        "readAt" timestamptz,
        "deliveredAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversationId")
          REFERENCES "conversations"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_messages_conversation_created_at" ON "messages" ("conversationId", "createdAt")',
    );
    await queryRunner.query(
      `CREATE TABLE "message_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipientId" character varying NOT NULL,
        "conversationId" character varying NOT NULL,
        "messageId" character varying NOT NULL,
        "ack" boolean NOT NULL DEFAULT false,
        "ackedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_notifications_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_message_notifications_recipient_conversation_message" ON "message_notifications" ("recipientId", "conversationId", "messageId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_message_notifications_recipient_ack_created_at" ON "message_notifications" ("recipientId", "ack", "createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_message_notifications_recipient_ack_created_at"');
    await queryRunner.query('DROP INDEX "IDX_message_notifications_recipient_conversation_message"');
    await queryRunner.query('DROP TABLE "message_notifications"');
    await queryRunner.query('DROP INDEX "IDX_messages_conversation_created_at"');
    await queryRunner.query('DROP TABLE "messages"');
    await queryRunner.query('DROP INDEX "IDX_conversations_pair_key"');
    await queryRunner.query('DROP TABLE "conversations"');
  }
}
