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
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = MailerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MailerService);
//# sourceMappingURL=mailer.service.js.map