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

  async sendWelcomeEmail(to: string, context: { name: string; type: 'INDIVIDUAL' | 'COMPANY' }) {
    const friendlyName = context.name?.trim() || 'nouvel utilisateur';
    if (!this.transporter) {
      this.logger.warn(`sendWelcomeEmail skipped (no transporter). Welcome for ${to}`);
      return false;
    }

    const subject = 'Bienvenue chez KariGo';
    const intro =
      context.type === 'COMPANY'
        ? 'Merci de faire confiance a KariGo pour vos trajets professionnels.'
        : 'Ravi de vous compter parmi les conducteurs et passagers KariGo.';
    const text = `Bonjour ${friendlyName},\n\n${intro}\n\nPubliez un trajet ou consultez les offres des autres membres pour demarrer rapidement.\n\nA tres vite sur la route !`;
    const html = `<p>Bonjour ${friendlyName},</p><p>${intro}</p><p>Publiez un trajet ou explorez les offres des autres membres pour demarrer rapidement.</p><p>A tres vite sur la route !</p>`;

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
      this.logger.error(`sendWelcomeEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }

  async sendRideDigestEmail(to: string, payload: {
    subject: string;
    text: string;
    html: string;
    attachments?: nodemailer.SendMailOptions['attachments'];
  }) {
    if (!this.transporter) {
      this.logger.warn(`sendRideDigestEmail skipped (no transporter) for ${to}`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        attachments: payload.attachments,
      });
      return true;
    } catch (err) {
      this.logger.error(`sendRideDigestEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }
}
