import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.from = process.env.SMTP_FROM || user || 'noreply@example.com';

    if (!host || !user || !pass) {
      this.logger.warn('SMTP credentials missing (SMTP_HOST / SMTP_USER / SMTP_PASS). Emails will not be sent.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendOtpEmail(to: string, code: string, ttlMinutes: number) {
    if (!this.transporter) {
      this.logger.warn(`sendOtpEmail skipped (no transporter). OTP for ${to}: ${code}`);
      return true;
    }

    const subject = 'Votre code de connexion KariGo';
    const text = `Votre code de connexion est ${code}. Il expire dans ${ttlMinutes} minutes.`;
    const html = `<p>Votre code de connexion est <strong>${code}</strong>.</p><p>Il expire dans ${ttlMinutes} minute(s).</p>`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (err) {
      this.logger.error(`sendOtpEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }
}
