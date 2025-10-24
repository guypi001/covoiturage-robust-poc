import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ArrayMaxSize,
  Matches,
} from 'class-validator';

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
}

export class RequestGmailOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyGmailOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{4,8}$/)
  code!: string;
}
