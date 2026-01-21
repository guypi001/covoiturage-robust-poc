import { IsInt, IsOptional, IsString, Min, MaxLength, IsIn } from 'class-validator';

export class CapturePaymentDto {
  @IsString()
  bookingId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CARD', 'MOBILE_MONEY', 'CASH'])
  paymentMethodType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentProvider?: string;
}

export class RefundPaymentDto {
  @IsString()
  bookingId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class WebhookEventDto {
  @IsString()
  eventId!: string;

  @IsString()
  type!: string;

  payload!: Record<string, any>;
}
