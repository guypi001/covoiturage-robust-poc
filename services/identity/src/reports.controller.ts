import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { CreateReportDto } from './dto';
import { ReportsService } from './reports.service';

type JwtPayload = {
  sub: string;
  email: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  role: 'USER' | 'ADMIN';
};

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateReportDto) {
    const payload = (req as any).user as JwtPayload | undefined;
    if (!payload) {
      throw new BadRequestException('missing_token');
    }

    if (!dto.targetAccountId && !dto.targetRideId && !dto.targetBookingId) {
      throw new BadRequestException('report_target_required');
    }

    const context = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    return this.reports.createReport(payload.sub, dto, context);
  }
}
