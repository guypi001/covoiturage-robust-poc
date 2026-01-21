import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportCategory } from './entities';
import { CreateReportDto } from './dto';
import { MailerService } from './mailer.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    private readonly mailer: MailerService,
  ) {}

  async createReport(
    reporterId: string,
    payload: CreateReportDto,
    context: Record<string, any>,
  ) {
    const report = this.reports.create({
      reporterId,
      targetAccountId: payload.targetAccountId ?? null,
      targetRideId: payload.targetRideId ?? null,
      targetBookingId: payload.targetBookingId ?? null,
      category: payload.category as ReportCategory,
      reason: payload.reason.trim().slice(0, 64),
      message: payload.message?.trim() || null,
      context: Object.keys(context || {}).length ? context : null,
    });
    const saved = await this.reports.save(report);

    const recipient = process.env.REPORTS_EMAIL || process.env.SUPPORT_EMAIL;
    if (recipient) {
      try {
        await this.mailer.sendReportEmail(recipient, {
          id: saved.id,
          reporterId: saved.reporterId,
          category: saved.category,
          reason: saved.reason,
          message: saved.message || undefined,
          targetAccountId: saved.targetAccountId || undefined,
          targetRideId: saved.targetRideId || undefined,
          targetBookingId: saved.targetBookingId || undefined,
        });
      } catch (err) {
        this.logger.warn(`sendReportEmail failed: ${(err as Error)?.message ?? err}`);
      }
    }

    return saved;
  }
}
