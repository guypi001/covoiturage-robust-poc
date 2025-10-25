import { BadRequestException, Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { InternalGuard } from './internal.guard';

@Controller('internal')
@UseGuards(InternalGuard)
export class InternalController {
  constructor(private readonly auth: AuthService) {}

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string) {
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
}
