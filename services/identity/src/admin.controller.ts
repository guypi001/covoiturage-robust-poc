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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { AdminGuard } from './admin.guard';
import {
  ListAccountsQueryDto,
  UpdateAccountProfileDto,
  UpdateAccountRoleDto,
  UpdateAccountStatusDto,
} from './dto';
import { Request } from 'express';

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAccountsController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  list(@Query() query: ListAccountsQueryDto) {
    return this.auth.listAccounts(query);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const trimmed = id?.trim();
    if (!trimmed) {
      throw new BadRequestException('id_required');
    }
    const account = await this.auth.getProfile(trimmed);
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    return account;
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAccountStatusDto, @Req() req: Request) {
    const actorId = ((req as any)?.user?.sub as string) || undefined;
    return this.auth.updateAccountStatus(id, dto.status, actorId);
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateAccountRoleDto, @Req() req: Request) {
    const actorId = ((req as any)?.user?.sub as string) || undefined;
    return this.auth.updateAccountRole(id, dto.role, actorId);
  }

  @Patch(':id/profile')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateAccountProfileDto) {
    return this.auth.adminUpdateAccountProfile(id, dto);
  }
}
