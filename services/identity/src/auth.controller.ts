import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterCompanyDto,
  RegisterIndividualDto,
  LoginDto,
  RequestGmailOtpDto,
  VerifyGmailOtpDto,
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register/individual')
  registerIndividual(@Body() dto: RegisterIndividualDto) {
    return this.auth.registerIndividual(dto);
  }

  @Post('register/company')
  registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.auth.registerCompany(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('gmail/request')
  requestGmail(@Body() dto: RequestGmailOtpDto) {
    return this.auth.requestGmailOtp(dto);
  }

  @Post('gmail/verify')
  verifyGmail(@Body() dto: VerifyGmailOtpDto) {
    return this.auth.verifyGmailOtp(dto);
  }

  @Post('password/forgot')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @Get('google/start')
  async startGoogle(@Res() res: Response, @Query('redirect') redirect?: string) {
    const url = this.auth.getGoogleOAuthUrl(redirect);
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const html = await this.auth.handleGoogleOAuthCallback({ code, state, error });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
