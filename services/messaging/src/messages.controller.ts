import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  TooManyRequestsException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Conversation, Message, MessageNotification } from './entities';
import {
  ConversationMessagesQueryDto,
  ConversationQueryDto,
  MarkConversationReadDto,
  MessageReadDto,
  NotificationsQueryDto,
  ParticipantType,
  SendMessageDto,
} from './dto';
import { EventBus } from './event-bus';
import { messageReadCounter, messageSentCounter } from './metrics';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { wsSendToUsers } from './ws';
import type { Request } from 'express';

const MESSAGE_RATE_LIMIT_PER_MIN = Number(process.env.MESSAGE_RATE_LIMIT_PER_MIN ?? 24);

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
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      attachmentType: message.attachmentType,
      clientMessageId: message.clientMessageId,
      messageType: message.messageType,
      status: message.status,
      readAt: message.readAt,
      deliveredAt: message.deliveredAt,
      createdAt: message.createdAt,
    };
  }

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: any, destination: string) => void) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
          fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (error: any, filename: string) => void) => {
          const ext = path.extname(file.originalname || '').toLowerCase() || '.dat';
          cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: any, acceptFile: boolean) => void) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('invalid_file_type'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAttachment(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file_required');
    }
    return {
      url: `/uploads/messages/${file.filename}`,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
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

    const body = dto.body?.trim() || '';
    const attachmentUrl = dto.attachmentUrl?.trim();
    if (!body && !attachmentUrl) {
      throw new BadRequestException('empty_message');
    }

    if (MESSAGE_RATE_LIMIT_PER_MIN > 0) {
      const since = new Date(Date.now() - 60 * 1000);
      const recentCount = await this.messages
        .createQueryBuilder('m')
        .where('m.senderId = :senderId', { senderId: dto.senderId })
        .andWhere('m.createdAt >= :since', { since })
        .getCount();
      if (recentCount >= MESSAGE_RATE_LIMIT_PER_MIN) {
        throw new TooManyRequestsException('rate_limited');
      }
    }

    const pairKey = this.buildPairKey(dto.senderId, dto.recipientId);
    let conversation = await this.getConversationOrFail(pairKey, dto);

    if (dto.clientMessageId) {
      const existing = await this.messages.findOne({
        where: { clientMessageId: dto.clientMessageId },
      });
      if (existing) {
        return {
          message: this.serializeMessage(existing),
          conversation: this.buildConversationSummary(conversation, dto.senderId),
        };
      }
    }

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
      attachmentUrl: attachmentUrl ?? null,
      attachmentName: dto.attachmentName?.trim() || null,
      attachmentType: dto.attachmentType?.trim() || null,
      clientMessageId: dto.clientMessageId?.trim() || null,
      messageType: dto.messageType === 'SYSTEM' ? 'SYSTEM' : 'USER',
      status: 'SENT',
    });

    const saved = await this.messages.save(message);
    saved.status = 'DELIVERED';
    saved.deliveredAt = new Date();
    await this.messages.save(saved);

    const preview = body
      ? body.slice(0, 280)
      : dto.attachmentName
        ? `Piece jointe: ${dto.attachmentName}`
        : 'Piece jointe';
    conversation.lastMessagePreview = preview;
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

    wsSendToUsers([dto.senderId, dto.recipientId], {
      type: 'message.new',
      data: {
        message: this.serializeMessage(saved),
        conversation: this.buildConversationSummary(conversation, dto.senderId),
      },
    });

    wsSendToUsers([dto.senderId], {
      type: 'message.delivered',
      data: { messageId: saved.id, deliveredAt: saved.deliveredAt?.toISOString() },
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

    const unreadMessages = await this.messages.find({
      where: { conversationId, recipientId: body.userId },
    });
    const unreadIds = unreadMessages.filter((msg) => msg.status !== 'READ').map((msg) => msg.id);
    if (unreadIds.length) {
      await this.messages
        .createQueryBuilder()
        .update(Message)
        .set({ status: 'READ', readAt: now })
        .where('id IN (:...ids)', { ids: unreadIds })
        .execute();
      const recipientType = this.getParticipantType(conversation, body.userId);
      messageReadCounter.inc({ recipient_type: recipientType }, unreadIds.length);
      await this.bus.publish('message.read', {
        conversationId,
        readerId: body.userId,
        count: unreadIds.length,
        readAt: now,
      });
      wsSendToUsers(
        unreadMessages.map((msg) => msg.senderId),
        {
          type: 'message.read',
          data: { messageIds: unreadIds, readAt: now.toISOString() },
        },
      );
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
    wsSendToUsers([body.userId], {
      type: 'message.read',
      data: { conversationId, unreadConversations },
    });
    return { ok: true, unreadConversations };
  }

  @Post('messages/read')
  async markMessagesRead(@Body() body: MessageReadDto) {
    if (!body.messageIds?.length) {
      throw new BadRequestException('message_ids_required');
    }
    const now = new Date();
    const ids = body.messageIds.slice(0, 200);
    const messages = await this.messages.find({ where: { id: In(ids) } });
    const targetIds = messages
      .filter((msg) => msg.recipientId === body.userId && msg.status !== 'READ')
      .map((msg) => msg.id);

    if (!targetIds.length) {
      return { ok: true, messageIds: [] };
    }

    await this.messages
      .createQueryBuilder()
      .update(Message)
      .set({ status: 'READ', readAt: now })
      .where('id IN (:...ids)', { ids: targetIds })
      .execute();

    await this.notifications
      .createQueryBuilder()
      .update(MessageNotification)
      .set({ ack: true, ackedAt: now })
      .where('messageId IN (:...ids)', { ids: targetIds })
      .andWhere('recipientId = :userId', { userId: body.userId })
      .andWhere('ack = false')
      .execute();

    wsSendToUsers(
      messages.map((msg) => msg.senderId),
      {
        type: 'message.read',
        data: { messageIds: targetIds, readAt: now.toISOString() },
      },
    );

    return { ok: true, messageIds: targetIds };
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
