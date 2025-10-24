import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Conversation, Message, MessageNotification } from './entities';
import {
  ConversationMessagesQueryDto,
  ConversationQueryDto,
  MarkConversationReadDto,
  NotificationsQueryDto,
  ParticipantType,
  SendMessageDto,
} from './dto';
import { EventBus } from './event-bus';
import { messageReadCounter, messageSentCounter } from './metrics';

@Controller()
export class MessagesController {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(MessageNotification) private readonly notifications: Repository<MessageNotification>,
    private readonly bus: EventBus,
  ) {}

  private buildPairKey(a: string, b: string) {
    return [a, b].sort().join('::');
  }

  private keepLabel(label?: string | null) {
    const trimmed = label?.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 120);
  }

  private ensureParticipant(conversation: Conversation, userId: string) {
    if (conversation.participantAId === userId || conversation.participantBId === userId) return;
    throw new BadRequestException('not_in_conversation');
  }

  private getParticipantType(conversation: Conversation, userId: string): ParticipantType {
    if (conversation.participantAId === userId) return conversation.participantAType;
    if (conversation.participantBId === userId) return conversation.participantBType;
    throw new BadRequestException('not_in_conversation');
  }

  private buildConversationSummary(
    conversation: Conversation,
    requesterId: string,
    unreadMap?: Map<string, number>,
  ) {
    const isParticipantA = conversation.participantAId === requesterId;
    const other = isParticipantA
      ? {
          id: conversation.participantBId,
          type: conversation.participantBType,
          label: conversation.participantBName,
        }
      : {
          id: conversation.participantAId,
          type: conversation.participantAType,
          label: conversation.participantAName,
        };

    return {
      id: conversation.id,
      otherParticipant: other,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      unreadCount: unreadMap?.get(conversation.id) ?? 0,
    };
  }

  private serializeMessage(message: Message) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      senderLabel: message.senderLabel,
      recipientId: message.recipientId,
      recipientType: message.recipientType,
      recipientLabel: message.recipientLabel,
      body: message.body,
      status: message.status,
      readAt: message.readAt,
      deliveredAt: message.deliveredAt,
      createdAt: message.createdAt,
    };
  }

  private async getConversationOrFail(pairKey: string, dto: SendMessageDto) {
    let conversation = await this.conversations.findOne({ where: { pairKey } });
    if (!conversation) {
      const participants = [
        {
          id: dto.senderId,
          type: dto.senderType,
          label: this.keepLabel(dto.senderLabel) ?? null,
        },
        {
          id: dto.recipientId,
          type: dto.recipientType,
          label: this.keepLabel(dto.recipientLabel) ?? null,
        },
      ].sort((a, b) => a.id.localeCompare(b.id));
      const [first, second] = participants;
      conversation = this.conversations.create({
        pairKey,
        participantAId: first.id,
        participantAType: first.type,
        participantAName: first.label,
        participantBId: second.id,
        participantBType: second.type,
        participantBName: second.label,
      });
      conversation = await this.conversations.save(conversation);
    } else {
      // Rafraîchit les labels si fournis
      const senderLabel = this.keepLabel(dto.senderLabel);
      const recipientLabel = this.keepLabel(dto.recipientLabel);
      if (senderLabel) {
        if (conversation.participantAId === dto.senderId) conversation.participantAName = senderLabel;
        if (conversation.participantBId === dto.senderId) conversation.participantBName = senderLabel;
      }
      if (recipientLabel) {
        if (conversation.participantAId === dto.recipientId) conversation.participantAName = recipientLabel;
        if (conversation.participantBId === dto.recipientId) conversation.participantBName = recipientLabel;
      }
      conversation = await this.conversations.save(conversation);
    }
    return conversation;
  }

  @Post('messages')
  async send(@Body() dto: SendMessageDto) {
    if (dto.senderId === dto.recipientId) {
      throw new BadRequestException('cannot_message_self');
    }

    const body = dto.body?.trim();
    if (!body) {
      throw new BadRequestException('empty_message');
    }

    const pairKey = this.buildPairKey(dto.senderId, dto.recipientId);
    let conversation = await this.getConversationOrFail(pairKey, dto);

    const message = this.messages.create({
      conversationId: conversation.id,
      senderId: dto.senderId,
      senderType: dto.senderType,
      senderLabel:
        conversation.participantAId === dto.senderId
          ? conversation.participantAName
          : conversation.participantBName,
      recipientId: dto.recipientId,
      recipientType: dto.recipientType,
      recipientLabel:
        conversation.participantAId === dto.recipientId
          ? conversation.participantAName
          : conversation.participantBName,
      body,
      status: 'DELIVERED',
    });

    const saved = await this.messages.save(message);

    conversation.lastMessagePreview = body.slice(0, 280);
    conversation.lastMessageAt = saved.createdAt;
    conversation = await this.conversations.save(conversation);

    await this.notifications.save(
      this.notifications.create({
        recipientId: dto.recipientId,
        conversationId: conversation.id,
        messageId: saved.id,
      }),
    );

    messageSentCounter.inc({ sender_type: dto.senderType });

    await this.bus.publish('message.sent', {
      messageId: saved.id,
      conversationId: conversation.id,
      senderId: dto.senderId,
      recipientId: dto.recipientId,
      body: body.slice(0, 280),
      createdAt: saved.createdAt,
    });

    return {
      message: this.serializeMessage(saved),
      conversation: this.buildConversationSummary(conversation, dto.senderId),
    };
  }

  @Get('conversations')
  async listConversations(@Query() query: ConversationQueryDto) {
    const conversations = await this.conversations.find({
      where: [{ participantAId: query.userId }, { participantBId: query.userId }],
      order: { updatedAt: 'DESC' },
    });

    const ids = conversations.map((c) => c.id);
    let unreadMap = new Map<string, number>();
    if (ids.length) {
      const rows = await this.notifications
        .createQueryBuilder('n')
        .select('n.conversationId', 'conversationId')
        .addSelect('COUNT(*)', 'count')
        .where('n.recipientId = :userId', { userId: query.userId })
        .andWhere('n.ack = false')
        .andWhere('n.conversationId IN (:...ids)', { ids })
        .groupBy('n.conversationId')
        .getRawMany<{ conversationId: string; count: string }>();
      unreadMap = new Map(rows.map((row) => [row.conversationId, Number(row.count)]));
    }

    return conversations.map((c) => this.buildConversationSummary(c, query.userId, unreadMap));
  }

  @Get('conversations/:id/messages')
  async listMessages(@Param('id') conversationId: string, @Query() query: ConversationMessagesQueryDto) {
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('conversation_not_found');
    }
    this.ensureParticipant(conversation, query.userId);

    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);

    const items = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return items.map((message) => this.serializeMessage(message));
  }

  @Post('conversations/:id/read')
  async markConversationRead(@Param('id') conversationId: string, @Body() body: MarkConversationReadDto) {
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('conversation_not_found');
    }
    this.ensureParticipant(conversation, body.userId);

    const now = new Date();

    const updateResult = await this.messages
      .createQueryBuilder()
      .update(Message)
      .set({ status: 'READ', readAt: now })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('recipientId = :userId', { userId: body.userId })
      .andWhere('status <> :read', { read: 'READ' })
      .execute();

    const affected = Number(updateResult.affected ?? 0);
    if (affected > 0) {
      const recipientType = this.getParticipantType(conversation, body.userId);
      messageReadCounter.inc({ recipient_type: recipientType }, affected);
      await this.bus.publish('message.read', {
        conversationId,
        readerId: body.userId,
        count: affected,
        readAt: now,
      });
    }

    await this.notifications
      .createQueryBuilder()
      .update(MessageNotification)
      .set({ ack: true, ackedAt: now })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('recipientId = :userId', { userId: body.userId })
      .andWhere('ack = false')
      .execute();

    const unreadConversations = await this.getUnreadConversationCount(body.userId);
    return { ok: true, unreadConversations };
  }

  private async getUnreadConversationCount(userId: string) {
    const row = await this.notifications
      .createQueryBuilder('n')
      .select('COUNT(DISTINCT n.conversationId)', 'cnt')
      .where('n.recipientId = :userId', { userId })
      .andWhere('n.ack = false')
      .getRawOne<{ cnt: string }>();
    return row?.cnt ? Number(row.cnt) : 0;
  }

  @Get('notifications')
  async notificationsList(@Query() query: NotificationsQueryDto) {
    const unreadConversations = await this.getUnreadConversationCount(query.userId);
    const unreadMessages = await this.notifications.count({
      where: { recipientId: query.userId, ack: false },
    });

    const items = await this.notifications.find({
      where: { recipientId: query.userId, ack: false },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const messageIds = items.map((item) => item.messageId);
    const conversationIds = items.map((item) => item.conversationId);

    const messageMap = new Map<string, Message>();
    if (messageIds.length) {
      const messages = await this.messages.find({ where: { id: In(messageIds) } });
      messages.forEach((msg) => messageMap.set(msg.id, msg));
    }

    const conversationMap = new Map<string, Conversation>();
    if (conversationIds.length) {
      const conversations = await this.conversations.find({ where: { id: In(conversationIds) } });
      conversations.forEach((conv) => conversationMap.set(conv.id, conv));
    }

    const formatted = items.map((notif) => {
      const message = messageMap.get(notif.messageId);
      const conversation = conversationMap.get(notif.conversationId);
      let sender = null;
      if (conversation && message) {
        sender =
          conversation.participantAId === message.senderId
            ? {
                id: conversation.participantAId,
                type: conversation.participantAType,
                label: conversation.participantAName,
              }
            : {
                id: conversation.participantBId,
                type: conversation.participantBType,
                label: conversation.participantBName,
              };
      }

      return {
        id: notif.id,
        conversationId: notif.conversationId,
        messageId: notif.messageId,
        preview: message?.body?.slice(0, 160) ?? null,
        createdAt: notif.createdAt,
        sender,
      };
    });

    return { unreadConversations, unreadMessages, items: formatted };
  }
}
