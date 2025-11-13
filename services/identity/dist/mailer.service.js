"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
let MailerService = MailerService_1 = class MailerService {
    constructor() {
        this.logger = new common_1.Logger(MailerService_1.name);
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
    async sendOtpEmail(to, code, ttlMinutes) {
        if (!this.transporter) {
            this.logger.warn(`sendOtpEmail skipped (no transporter). OTP for ${to}: ${code}`);
            return true;
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
        }
        catch (err) {
            this.logger.error(`sendOtpEmail failed for ${to}: ${err?.message || err}`);
            return false;
        }
    }
    async sendWelcomeEmail(to, context) {
        const friendlyName = context.name?.trim() || 'nouvel utilisateur';
        if (!this.transporter) {
            this.logger.warn(`sendWelcomeEmail skipped (no transporter). Welcome for ${to}`);
            return false;
        }
        const subject = 'Bienvenue chez KariGo';
        const intro = context.type === 'COMPANY'
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
        }
        catch (err) {
            this.logger.error(`sendWelcomeEmail failed for ${to}: ${err?.message || err}`);
            return false;
        }
    }
    async sendRideDigestEmail(to, payload) {
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
        }
        catch (err) {
            this.logger.error(`sendRideDigestEmail failed for ${to}: ${err?.message || err}`);
            return false;
        }
    }
    async sendPasswordResetEmail(to, context) {
        if (!this.transporter) {
            this.logger.warn(`sendPasswordResetEmail skipped (no transporter). Link for ${to}: ${context.resetUrl}`);
            return false;
        }
        const subject = 'Réinitialisation du mot de passe KariGo';
        const friendlyName = context.name?.trim() || 'membre KariGo';
        const expirationMinutes = Math.max(1, Math.round((context.expiresAt.getTime() - Date.now()) / 60000));
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
        }
        catch (err) {
            this.logger.error(`sendPasswordResetEmail failed for ${to}: ${err?.message || err}`);
            return false;
        }
    }
    renderTemplate(options) {
        const preview = options.previewText ?? 'KariGo';
        const footerNote = options.footerNote ??
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
                ${options.intro
            ? `<p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">${options.intro}</p>`
            : ''}
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
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = MailerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailerService);
//# sourceMappingURL=mailer.service.js.map