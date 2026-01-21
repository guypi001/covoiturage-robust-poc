import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type EmailTemplateOptions = {
  title: string;
  intro?: string;
  bodyHtml: string;
  previewText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

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
      if (process.env.SMTP_LOG_ONLY === 'true') {
        this.logger.warn(`sendOtpEmail log-only. OTP for ${to}: ${code}`);
        return true;
      }
      this.logger.warn(`sendOtpEmail skipped (no transporter). OTP for ${to}: ${code}`);
      return false;
    }

    const subject = 'Votre code de connexion KariGo';
    const text = `Votre code de connexion est ${code}. Il expire dans ${ttlMinutes} minutes.`;
    const html = this.renderTemplate({
      title: 'Connexion sécurisée',
      intro: 'Voici ton code à usage unique pour te connecter à KariGo.',
      bodyHtml: `
        <div style="margin:24px 0;padding:16px 20px;border-radius:16px;border:1px dashed #bae6fd;background:#f0f9ff;text-align:center;font-size:20px;font-weight:600;color:#0c4a6e;letter-spacing:4px;">
          ${code}
        </div>
        <p style="margin:0 0 8px 0;font-size:14px;color:#334155;">
          Il reste valide pendant <strong>${ttlMinutes} minute(s)</strong>. Ne partage jamais ce code et assure-toi d'être sur l'application officielle KariGo.
        </p>
      `,
      previewText: 'Ton code de connexion KariGo',
    });

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
      return process.env.SMTP_LOG_ONLY === 'true';
    }

    const subject = 'Bienvenue chez KariGo';
    const intro =
      context.type === 'COMPANY'
        ? 'Merci de faire confiance a KariGo pour vos trajets professionnels.'
        : 'Ravi de vous compter parmi les conducteurs et passagers KariGo.';
    const text = `Bonjour ${friendlyName},\n\n${intro}\n\nPubliez un trajet ou consultez les offres des autres membres pour demarrer rapidement.\n\nA tres vite sur la route !`;
    const html = this.renderTemplate({
      title: `Bienvenue ${friendlyName}`,
      intro,
      bodyHtml: `
        <p style="margin:0 0 12px 0;font-size:14px;color:#334155;">
          KariGo rassemble la communauté covoiturage pro et particulier. Voici ce que tu peux faire dès maintenant :
        </p>
        <ul style="margin:0 0 16px 16px;padding:0;color:#334155;font-size:14px;line-height:1.6;">
          <li>Publier ou rechercher un trajet en quelques clics.</li>
          <li>Discuter en toute sécurité avec les passagers/conducteurs.</li>
          <li>Suivre tes réservations et statistiques depuis ton espace.</li>
        </ul>
        <p style="margin:0;font-size:14px;color:#334155;">Nous sommes ravis de t’accompagner sur les routes de Côte d’Ivoire.</p>
      `,
      ctaLabel: 'Découvrir le tableau de bord',
      ctaUrl: `${process.env.APP_BASE_URL ?? 'https://app.karigo.ci'}`,
      previewText: 'Bienvenue sur la plateforme KariGo',
    });

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

  async sendPasswordResetEmail(
    to: string,
    context: { name?: string | null; resetUrl: string; expiresAt: Date },
  ) {
    if (!this.transporter) {
      if (process.env.SMTP_LOG_ONLY === 'true') {
        this.logger.warn(`sendPasswordResetEmail log-only. Link for ${to}: ${context.resetUrl}`);
        return true;
      }
      this.logger.warn(`sendPasswordResetEmail skipped (no transporter). Link for ${to}: ${context.resetUrl}`);
      return false;
    }

    const subject = 'Réinitialisation du mot de passe KariGo';
    const friendlyName = context.name?.trim() || 'membre KariGo';
    const expirationMinutes = Math.max(
      1,
      Math.round((context.expiresAt.getTime() - Date.now()) / 60000),
    );
    const text = `Bonjour ${friendlyName},\n\nClique sur le lien suivant pour choisir un nouveau mot de passe KariGo : ${context.resetUrl}\n\nCe lien reste actif pendant ${expirationMinutes} minute(s). Si tu n'es pas à l'origine de cette demande, ignore ce message.\n\nL'équipe KariGo`;
    const html = this.renderTemplate({
      title: 'Réinitialise ton mot de passe',
      intro: `Bonjour ${friendlyName},`,
      bodyHtml: `
        <p style="margin:0 0 16px 0;font-size:14px;color:#334155;">
          Tu viens de demander un nouveau mot de passe. Clique sur le bouton ci-dessous pour en définir un nouveau. Le lien reste actif pendant ${expirationMinutes} minute(s).
        </p>
        <p style="margin:0 0 16px 0;font-size:14px;color:#334155;">
          Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet e-mail. Ton mot de passe actuel reste inchangé.
        </p>
      `,
      ctaLabel: 'Choisir un nouveau mot de passe',
      ctaUrl: context.resetUrl,
      previewText: 'Réinitialise ton mot de passe KariGo',
    });

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
      this.logger.error(`sendPasswordResetEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }

  async sendReportEmail(
    to: string,
    payload: {
      id: string;
      reporterId: string;
      category: string;
      reason: string;
      message?: string;
      targetAccountId?: string;
      targetRideId?: string;
      targetBookingId?: string;
    },
  ) {
    if (!this.transporter) {
      this.logger.warn(`sendReportEmail skipped (no transporter) for ${to}`);
      return false;
    }

    const subject = `Signalement KariGo - ${payload.reason}`;
    const text = [
      `Signalement ${payload.id}`,
      `Categorie: ${payload.category}`,
      `Motif: ${payload.reason}`,
      payload.message ? `Message: ${payload.message}` : null,
      `Reporter: ${payload.reporterId}`,
      payload.targetAccountId ? `Compte cible: ${payload.targetAccountId}` : null,
      payload.targetRideId ? `Trajet cible: ${payload.targetRideId}` : null,
      payload.targetBookingId ? `Reservation cible: ${payload.targetBookingId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const html = this.renderTemplate({
      title: 'Nouveau signalement',
      intro: 'Un membre KariGo a signale un contenu.',
      bodyHtml: `
        <ul style="margin:0 0 16px 16px;padding:0;color:#334155;font-size:14px;line-height:1.6;">
          <li><strong>ID</strong> : ${payload.id}</li>
          <li><strong>Categorie</strong> : ${payload.category}</li>
          <li><strong>Motif</strong> : ${payload.reason}</li>
          ${payload.message ? `<li><strong>Message</strong> : ${payload.message}</li>` : ''}
          <li><strong>Reporter</strong> : ${payload.reporterId}</li>
          ${payload.targetAccountId ? `<li><strong>Compte cible</strong> : ${payload.targetAccountId}</li>` : ''}
          ${payload.targetRideId ? `<li><strong>Trajet cible</strong> : ${payload.targetRideId}</li>` : ''}
          ${payload.targetBookingId ? `<li><strong>Reservation cible</strong> : ${payload.targetBookingId}</li>` : ''}
        </ul>
      `,
      previewText: 'Nouveau signalement KariGo',
    });

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
      this.logger.error(`sendReportEmail failed for ${to}: ${(err as Error)?.message || err}`);
      return false;
    }
  }

  renderTemplate(options: EmailTemplateOptions) {
    const preview = options.previewText ?? 'KariGo';
    const footerNote =
      options.footerNote ??
      'Cet e-mail a été envoyé automatiquement par KariGo. Merci de ne pas y répondre directement.';
    const ctaBlock = options.ctaLabel && options.ctaUrl
      ? `<a href="${options.ctaUrl}" style="display:inline-flex;padding:12px 24px;border-radius:999px;background:#0f172a;color:#ffffff;font-weight:600;text-decoration:none;margin-top:12px;">${options.ctaLabel}</a>`
      : '';

    return `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${options.title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:'Inter','Segoe UI',Tahoma,sans-serif;color:#0f172a;">
    <span style="display:none;visibility:hidden;">${preview}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 15px 45px rgba(15,23,42,0.08);">
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <div style="font-size:12px;font-weight:600;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.08em;">KariGo</div>
                <h1 style="margin:12px 0 8px 0;font-size:24px;">${options.title}</h1>
                ${
                  options.intro
                    ? `<p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">${options.intro}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.7;color:#334155;">
                ${options.bodyHtml}
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding-top:28px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;">
                ${footerNote}<br />
                © ${new Date().getFullYear()} KariGo
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
  }
}
