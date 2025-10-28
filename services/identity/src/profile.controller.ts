import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { UpdateCompanyProfileDto, UpdateIndividualProfileDto } from './dto';
import type { AccountRole, AccountStatus, AccountType } from './entities';
import { Request } from 'express';

type JwtPayload = {
  sub: string;
  email: string;
  type: AccountType;
  role: AccountRole;
  status: AccountStatus;
};

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

  @Get('lookup')
  async lookup(@Req() req: Request, @Query('email') email?: string) {
    this.getPayload(req); // assure que l'appelant est authentifié
    if (!email?.trim()) {
      throw new BadRequestException('email_required');
    }
    const account = await this.auth.lookupByEmail(email);
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    return account;
  }

  @Get(':id/public')
  async publicProfile(@Req() req: Request, @Param('id') id: string) {
    this.getPayload(req);
    if (!id?.trim()) {
      throw new BadRequestException('id_required');
    }
    const account = await this.auth.getPublicProfile(id);
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    return account;
  }
}
