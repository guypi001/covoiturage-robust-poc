import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ParticipantType } from './dto';

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

@Entity('conversations')
@Index(['pairKey'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  pairKey!: string;

  @Column()
  participantAId!: string;

  @Column({ type: 'varchar' })
  participantAType!: ParticipantType;

  @Column({ type: 'varchar', nullable: true })
  participantAName!: string | null;

  @Column()
  participantBId!: string;

  @Column({ type: 'varchar' })
  participantBType!: ParticipantType;

  @Column({ type: 'varchar', nullable: true })
  participantBName!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastMessagePreview?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages!: Message[];
}

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column()
  senderId!: string;

  @Column({ type: 'varchar' })
  senderType!: ParticipantType;

  @Column({ type: 'varchar', nullable: true })
  senderLabel!: string | null;

  @Column()
  recipientId!: string;

  @Column({ type: 'varchar' })
  recipientType!: ParticipantType;

  @Column({ type: 'varchar', nullable: true })
  recipientLabel!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
  attachmentUrl?: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', nullable: true })
  attachmentName?: string | null;

  @Column({ name: 'attachment_type', type: 'varchar', nullable: true })
  attachmentType?: string | null;

  @Column({ type: 'varchar', default: 'DELIVERED' })
  status!: MessageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('message_notifications')
@Index(['recipientId', 'conversationId', 'messageId'])
@Index(['recipientId', 'ack', 'createdAt'])
export class MessageNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  recipientId!: string;

  @Column()
  conversationId!: string;

  @Column()
  messageId!: string;

  @Column({ default: false })
  ack!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  ackedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
