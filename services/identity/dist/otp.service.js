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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const bcrypt = __importStar(require("bcryptjs"));
const mailer_service_1 = require("./mailer.service");
const metrics_1 = require("./metrics");
const OTP_TTL_MINUTES = Number(process.env.GMAIL_OTP_TTL_MINUTES || 10);
const OTP_LENGTH = Number(process.env.GMAIL_OTP_LENGTH || 6);
const OTP_SALT_ROUNDS = 6;
const OTP_MAX_ATTEMPTS = Number(process.env.GMAIL_OTP_MAX_ATTEMPTS || 5);
let OtpService = class OtpService {
    constructor(tokens, mailer) {
        this.tokens = tokens;
        this.mailer = mailer;
    }
    assertGmail(email) {
        if (!email.endsWith('@gmail.com')) {
            throw new common_1.BadRequestException('gmail_only');
        }
    }
    generateCode() {
        const pow = 10 ** OTP_LENGTH;
        const min = 10 ** (OTP_LENGTH - 1);
        const code = Math.floor(Math.random() * (pow - min)) + min;
        return String(code).padStart(OTP_LENGTH, '0');
    }
    async requestOtp(rawEmail) {
        const email = rawEmail.trim().toLowerCase();
        this.assertGmail(email);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
        const code = this.generateCode();
        const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);
        await this.tokens.delete({ email });
        await this.tokens.save(this.tokens.create({
            email,
            codeHash,
            expiresAt,
        }));
        await this.cleanupExpired();
        const sent = await this.mailer.sendOtpEmail(email, code, OTP_TTL_MINUTES);
        if (!sent) {
            throw new common_1.ServiceUnavailableException('otp_email_failed');
        }
        metrics_1.otpRequestCounter.inc({ channel: 'gmail' });
    }
    async verifyOtp(rawEmail, code) {
        const email = rawEmail.trim().toLowerCase();
        this.assertGmail(email);
        const entry = await this.tokens.findOne({ where: { email } });
        if (!entry) {
            metrics_1.otpValidationCounter.inc({ result: 'not_found' });
            throw new common_1.UnauthorizedException('otp_not_found');
        }
        if (entry.expiresAt.getTime() < Date.now()) {
            await this.tokens.delete(entry.id);
            metrics_1.otpValidationCounter.inc({ result: 'expired' });
            throw new common_1.UnauthorizedException('otp_expired');
        }
        if (entry.attempts >= OTP_MAX_ATTEMPTS) {
            await this.tokens.delete(entry.id);
            metrics_1.otpValidationCounter.inc({ result: 'blocked' });
            throw new common_1.UnauthorizedException('otp_blocked');
        }
        const ok = await bcrypt.compare(code, entry.codeHash);
        if (!ok) {
            entry.attempts += 1;
            await this.tokens.save(entry);
            metrics_1.otpValidationCounter.inc({ result: 'invalid' });
            throw new common_1.UnauthorizedException('otp_invalid');
        }
        await this.tokens.delete(entry.id);
        await this.cleanupExpired();
        metrics_1.otpValidationCounter.inc({ result: 'success' });
    }
    async cleanupExpired() {
        await this.tokens.delete({ expiresAt: (0, typeorm_2.LessThan)(new Date()) });
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.OtpToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        mailer_service_1.MailerService])
], OtpService);
//# sourceMappingURL=otp.service.js.map