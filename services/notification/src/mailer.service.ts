import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type MessageEmailPayload = {
  recipientName: string;
  senderName: string;
  preview?: string | null;
  conversationId?: string;
};

type BookingEmailPayload = {
  passengerName: string;
  originCity?: string | null;
  destinationCity?: string | null;
  departureAt?: string | null;
  seats?: number;
  amount?: number;
  rideId?: string;
};

type ReceiptEmailPayload = {
  bookingId: string;
  passengerName: string;
  passengerEmail?: string;
  originCity?: string;
  destinationCity?: string;
  departureAt?: string;
  seats?: number;
  amount?: number;
  paymentMethod?: string;
  issuedAt?: string;
  rideId?: string;
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

  async sendBookingConfirmationEmail(to: string, payload: BookingEmailPayload) {
    if (!this.transporter) {
      this.logger.warn(`sendBookingConfirmationEmail skipped (no transporter). Target ${to}`);
      return false;
    }

    const departureLabel = payload.departureAt
      ? new Date(payload.departureAt).toLocaleString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'bientôt';
    const link = `${this.frontendUrl.replace(/\/$/, '')}/my-trips`;
    const subject = 'Ta réservation KariGo est confirmée ✅';
    const amountLabel = payload.amount ? `${payload.amount.toLocaleString?.() ?? payload.amount} XOF` : undefined;

    const textLines = [
      `Bonjour ${payload.passengerName},`,
      `Ta réservation pour le trajet ${payload.originCity ?? '?'} → ${payload.destinationCity ?? '?'} est confirmée.`,
      `Départ : ${departureLabel}`,
      `Places réservées : ${payload.seats ?? 1}`,
    ];
    if (amountLabel) textLines.push(`Montant : ${amountLabel}`);
    textLines.push('', `Consulte ta réservation : ${link}`, '', 'Bon voyage avec KariGo !');

    const htmlParts = [
      `<p>Bonjour ${payload.passengerName},</p>`,
      `<p>Ta réservation pour le trajet <strong>${payload.originCity ?? '?'}</strong> → <strong>${payload.destinationCity ?? '?'}</strong> est confirmée.</p>`,
      `<ul style="padding-left:18px;color:#333;">
        <li><strong>Départ :</strong> ${departureLabel}</li>
        <li><strong>Places :</strong> ${payload.seats ?? 1}</li>
        ${amountLabel ? `<li><strong>Montant :</strong> ${amountLabel}</li>` : ''}
      </ul>`,
      `<p><a href="${link}" style="background:#0c6efd;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Voir ma réservation</a></p>`,
      '<p>Bon voyage avec KariGo !</p>',
    ];

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
      this.logger.error(`sendBookingConfirmationEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
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

  async sendPaymentReceiptEmail(to: string, payload: ReceiptEmailPayload) {
    if (!this.transporter) {
      this.logger.warn(`sendPaymentReceiptEmail skipped (no transporter). Target ${to}`);
      return false;
    }

    const issuedAt = payload.issuedAt ? new Date(payload.issuedAt) : new Date();
    const issuedLabel = issuedAt.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const departureLabel = payload.departureAt
      ? new Date(payload.departureAt).toLocaleString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'bientot';
    const amountLabel = payload.amount ? `${payload.amount.toLocaleString?.() ?? payload.amount} XOF` : undefined;
    const subject = 'Recu de paiement KariGo';
    const link = `${this.frontendUrl.replace(/\/$/, '')}/my-trips`;

    const textLines = [
      `Bonjour ${payload.passengerName},`,
      `Voici ton recu pour la reservation ${payload.bookingId}.`,
      `Trajet : ${payload.originCity ?? '?'} -> ${payload.destinationCity ?? '?'}`,
      `Depart : ${departureLabel}`,
      `Places : ${payload.seats ?? 1}`,
    ];
    if (amountLabel) textLines.push(`Montant : ${amountLabel}`);
    if (payload.paymentMethod) textLines.push(`Moyen : ${payload.paymentMethod}`);
    textLines.push(`Emis le : ${issuedLabel}`, '', `Voir mes reservations : ${link}`);

    const htmlParts = [
      `<p>Bonjour ${payload.passengerName},</p>`,
      `<p>Ton recu pour la reservation <strong>${payload.bookingId}</strong> est disponible.</p>`,
      `<ul style="padding-left:18px;color:#333;">
        <li><strong>Trajet :</strong> ${payload.originCity ?? '?'} → ${payload.destinationCity ?? '?'}</li>
        <li><strong>Depart :</strong> ${departureLabel}</li>
        <li><strong>Places :</strong> ${payload.seats ?? 1}</li>
        ${amountLabel ? `<li><strong>Montant :</strong> ${amountLabel}</li>` : ''}
        ${payload.paymentMethod ? `<li><strong>Moyen :</strong> ${payload.paymentMethod}</li>` : ''}
        <li><strong>Emis le :</strong> ${issuedLabel}</li>
      </ul>`,
      `<p><a href="${link}" style="background:#0c6efd;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Voir mes reservations</a></p>`,
      '<p>Bon voyage avec KariGo !</p>',
    ];

    const pdfBuffer = buildReceiptPdfBuffer({
      bookingId: payload.bookingId,
      passengerName: payload.passengerName,
      passengerEmail: payload.passengerEmail,
      originCity: payload.originCity,
      destinationCity: payload.destinationCity,
      departureAt: payload.departureAt,
      seats: payload.seats,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      issuedAt: payload.issuedAt,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: textLines.join('\n'),
        html: htmlParts.join(''),
        attachments: [
          {
            filename: `recu-${payload.bookingId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      return true;
    } catch (err) {
      this.logger.error(`sendPaymentReceiptEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }
}

type ReceiptPdfPayload = {
  bookingId: string;
  passengerName: string;
  passengerEmail?: string;
  originCity?: string;
  destinationCity?: string;
  departureAt?: string;
  seats?: number;
  amount?: number;
  paymentMethod?: string;
  issuedAt?: string;
};

const escapePdfText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildReceiptPdfBuffer = (payload: ReceiptPdfPayload) => {
  const issuedLabel = payload.issuedAt
    ? new Date(payload.issuedAt).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR');
  const departureLabel = payload.departureAt
    ? new Date(payload.departureAt).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'bientot';
  const amountLabel = payload.amount ? `${payload.amount.toLocaleString?.() ?? payload.amount} XOF` : '0 XOF';

  const lines = [
    'KariGo - Recu de paiement',
    `Reference: ${payload.bookingId}`,
    `Emis le: ${issuedLabel}`,
    '',
    `Client: ${payload.passengerName}`,
    `Email: ${payload.passengerEmail || 'Non fourni'}`,
    `Trajet: ${payload.originCity ?? '?'} -> ${payload.destinationCity ?? '?'}`,
    `Depart: ${departureLabel}`,
    `Places: ${payload.seats ?? 1}`,
    `Moyen: ${payload.paymentMethod ?? 'Paiement'}`,
    `Montant: ${amountLabel}`,
  ];

  const content = [
    'BT',
    '/F1 12 Tf',
    '50 800 Td',
    '16 TL',
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'binary');
};
