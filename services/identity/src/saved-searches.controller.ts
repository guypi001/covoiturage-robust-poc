import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { SavedSearchesService } from './saved-searches.service';
import { CreateSavedSearchDto } from './dto';
import { Request } from 'express';

@Controller('saved-searches')
@UseGuards(JwtAuthGuard)
export class SavedSearchesController {
  constructor(private readonly searches: SavedSearchesService) {}

  private getAccountId(req: Request) {
    const payload = (req as any).user;
    if (!payload?.sub) {
      throw new BadRequestException('missing_token');
    }
    return payload.sub as string;
  }

  @Get()
  async list(@Req() req: Request) {
    const accountId = this.getAccountId(req);
    return this.searches.listForAccount(accountId);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateSavedSearchDto) {
    const accountId = this.getAccountId(req);
    return this.searches.create(accountId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const accountId = this.getAccountId(req);
    return this.searches.remove(accountId, id);
  }
}
