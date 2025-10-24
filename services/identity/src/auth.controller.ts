import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterCompanyDto,
  RegisterIndividualDto,
  LoginDto,
  RequestGmailOtpDto,
  VerifyGmailOtpDto,
} from './dto';

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
}
