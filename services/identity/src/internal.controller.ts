import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { InternalGuard } from './internal.guard';
import { SavedSearchesService } from './saved-searches.service';

@Controller('internal')
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly auth: AuthService,
    private readonly searches: SavedSearchesService,
  ) {}

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

  @Get('accounts')
  async listAccounts(@Query('ids') ids?: string) {
    const list = typeof ids === 'string'
      ? ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 500)
      : [];
    if (!list.length) {
      return { data: [] };
    }
    const accounts = await this.auth.getProfiles(list);
    return { data: accounts };
  }

  @Get('saved-searches')
  async listSavedSearches(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
  ) {
    const originCity = origin?.trim();
    const destinationCity = destination?.trim();
    if (!originCity || !destinationCity) {
      throw new BadRequestException('origin_and_destination_required');
    }
    const data = await this.searches.findForRoute(originCity, destinationCity);
    return { data };
  }
}
