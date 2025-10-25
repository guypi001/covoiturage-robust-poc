import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type MessageEmailPayload = {
  recipientName: string;
  senderName: string;
  preview?: string | null;
  conversationId?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly from: string;
  private readonly frontendUrl: string;
  private transporter?: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.from = process.env.SMTP_FROM || user || 'noreply@example.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';

    if (!host || !user || !pass) {
      this.logger.warn('SMTP credentials missing (SMTP_HOST / SMTP_USER / SMTP_PASS). Emails disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendMessageEmail(to: string, payload: MessageEmailPayload) {
    if (!this.transporter) {
      this.logger.warn(`sendMessageEmail skipped (no transporter). Target ${to}`);
      return false;
    }

    const safePreview = payload.preview?.trim();
    const subject = `Nouveau message de ${payload.senderName}`;
    const link = payload.conversationId
      ? `${this.frontendUrl.replace(/\/$/, '')}/messages/${payload.conversationId}`
      : this.frontendUrl;
    const textLines = [
      `Bonjour ${payload.recipientName},`,
      `Vous avez recu un nouveau message de ${payload.senderName} sur KariGo.`,
    ];
    if (safePreview) {
      textLines.push('', `"${safePreview}"`);
    }
    textLines.push('', `Consultez la conversation: ${link}`, '', 'A tres vite sur KariGo !');

    const htmlParts = [
      `<p>Bonjour ${payload.recipientName},</p>`,
      `<p>Vous avez recu un nouveau message de <strong>${payload.senderName}</strong> sur KariGo.</p>`,
    ];
    if (safePreview) {
      htmlParts.push(`<blockquote style="margin:12px 0;padding-left:12px;border-left:3px solid #ccc;color:#333;">${safePreview}</blockquote>`);
    }
    htmlParts.push(
      `<p><a href="${link}" style="background:#0c6efd;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Ouvrir la conversation</a></p>`,
      '<p>A tres vite sur KariGo !</p>',
    );

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: textLines.join('\n'),
        html: htmlParts.join(''),
      });
      return true;
    } catch (err) {
      this.logger.error(`sendMessageEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }
}
