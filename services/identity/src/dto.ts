import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { AccountRole, AccountStatus, AccountType, HomePreferences } from './entities';

export const HOME_THEME_OPTIONS = ['default', 'sunset', 'night'] as const;
export const HOME_QUICK_ACTION_OPTIONS = [
  'create_ride',
  'view_messages',
  'view_bookings',
  'explore_offers',
  'profile_settings',
  'manage_fleet',
] as const;

export class HomeFavoriteRouteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  from!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  to!: string;
}

type HomeTheme = (typeof HOME_THEME_OPTIONS)[number];

export class HomePreferencesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeFavoriteRouteDto)
  favoriteRoutes?: HomeFavoriteRouteDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(HOME_QUICK_ACTION_OPTIONS as readonly string[], { each: true })
  quickActions?: Array<(typeof HOME_QUICK_ACTION_OPTIONS)[number]>;

  @IsOptional()
  @IsIn(HOME_THEME_OPTIONS as readonly string[])
  theme?: HomeTheme;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  heroMessage?: string;

  @IsOptional()
  @IsBoolean()
  showTips?: boolean;
}

export class RegisterIndividualDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  comfortPreferences?: string[];

  @IsOptional()
  @IsString()
  @MinLength(4)
  tagline?: string;
}

export class RegisterCompanyDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateIndividualProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  comfortPreferences?: string[];

  @IsOptional()
  @IsString()
  @MinLength(4)
  tagline?: string;

  @IsOptional()
  @IsBoolean()
  removeTagline?: boolean;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1024)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  removeProfilePhoto?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomePreferencesDto)
  homePreferences?: HomePreferencesDto;
}

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1024)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  removeProfilePhoto?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsBoolean()
  removeTagline?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomePreferencesDto)
  homePreferences?: HomePreferencesDto;
}

export class AdminSendRideDigestDto {
  @IsEmail()
  recipient!: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destination?: string;

  @IsOptional()
  @IsDateString()
  departureAfter?: string;

  @IsOptional()
  @IsDateString()
  departureBefore?: string;

  @IsOptional()
  @IsIn(['PUBLISHED', 'CLOSED', 'ALL'] as const)
  status?: 'PUBLISHED' | 'CLOSED' | 'ALL';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  includeInsights?: boolean;

  @IsOptional()
  @IsBoolean()
  attachCsv?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsIn(['ALL', 'ACCOUNT_ONLY'] as const)
  targetScope?: 'ALL' | 'ACCOUNT_ONLY';

  @IsOptional()
  @IsBoolean()
  includeUpcomingOnly?: boolean;
}

export class RequestGmailOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyGmailOtpDto {
  @IsEmail()
  email!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D+/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{4,8}$/)
  code!: string;
}

export class ListAccountsQueryDto {
  @IsOptional()
  @IsIn(['INDIVIDUAL', 'COMPANY'])
  type?: AccountType;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpdateAccountStatusDto {
  @IsString()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: AccountStatus;
}

export class UpdateAccountRoleDto {
  @IsString()
  @IsIn(['USER', 'ADMIN'])
  role!: AccountRole;
}

export class UpdateAccountProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  comfortPreferences?: string[];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1024)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  removeProfilePhoto?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsBoolean()
  removeTagline?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomePreferencesDto)
  homePreferences?: HomePreferencesDto;
}
