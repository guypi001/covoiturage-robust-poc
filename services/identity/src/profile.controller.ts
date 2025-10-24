import { Body, Controller, Get, Patch, Req, UseGuards, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { UpdateCompanyProfileDto, UpdateIndividualProfileDto } from './dto';
import { Request } from 'express';

type JwtPayload = { sub: string; email: string; type: 'INDIVIDUAL' | 'COMPANY' };

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly auth: AuthService) {}

  private getPayload(req: Request): JwtPayload {
    const payload = (req as any).user as JwtPayload | undefined;
    if (!payload) {
      throw new UnauthorizedException('missing_token');
    }
    return payload;
  }

  @Get('me')
  async me(@Req() req: Request) {
    const payload = this.getPayload(req);
    return this.auth.getProfile(payload.sub);
  }

  @Patch('me/individual')
  async updateIndividual(@Req() req: Request, @Body() dto: UpdateIndividualProfileDto) {
    const payload = this.getPayload(req);
    if (payload.type !== 'INDIVIDUAL') {
      throw new ForbiddenException('invalid_account_type');
    }
    return this.auth.updateIndividualProfile(payload.sub, dto);
  }

  @Patch('me/company')
  async updateCompany(@Req() req: Request, @Body() dto: UpdateCompanyProfileDto) {
    const payload = this.getPayload(req);
    if (payload.type !== 'COMPANY') {
      throw new ForbiddenException('invalid_account_type');
    }
    return this.auth.updateCompanyProfile(payload.sub, dto);
  }
}
