import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(128)
  ownerId!: string;

  @IsString()
  @MaxLength(256)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class PushTestDto {
  @IsString()
  @MaxLength(128)
  ownerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  body?: string;
}
