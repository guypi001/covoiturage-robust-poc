import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export type ParticipantType = 'INDIVIDUAL' | 'COMPANY';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  senderId!: string;

  @IsIn(['INDIVIDUAL', 'COMPANY'])
  senderType!: ParticipantType;

  @IsString()
  @IsNotEmpty()
  recipientId!: string;

  @IsIn(['INDIVIDUAL', 'COMPANY'])
  recipientType!: ParticipantType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;

  @IsOptional()
  @IsString()
  senderLabel?: string;

  @IsOptional()
  @IsString()
  recipientLabel?: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;

  @IsOptional()
  @IsIn(['USER', 'SYSTEM'])
  messageType?: 'USER' | 'SYSTEM';
}

export class ConversationQueryDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class ConversationMessagesQueryDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class MarkConversationReadDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class MessageReadDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsArray()
  messageIds!: string[];
}

export class NotificationsQueryDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
