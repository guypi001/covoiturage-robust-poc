import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PhoneOtpToken } from './entities';
import { SmsService } from './sms.service';

const PHONE_OTP_TTL_MINUTES = Number(process.env.PHONE_OTP_TTL_MINUTES || 10);
const PHONE_OTP_LENGTH = Number(process.env.PHONE_OTP_LENGTH || 6);
const PHONE_OTP_SALT_ROUNDS = 6;
const PHONE_OTP_MAX_ATTEMPTS = Number(process.env.PHONE_OTP_MAX_ATTEMPTS || 5);

@Injectable()
export class PhoneOtpService {
  constructor(
    @InjectRepository(PhoneOtpToken) private readonly tokens: Repository<PhoneOtpToken>,
    private readonly sms: SmsService,
  ) {}

  normalizePhone(value: string) {
    const trimmed = value.trim();
    const cleaned = trimmed.replace(/[^\d+]/g, '');
    if (!cleaned || cleaned.length < 6 || cleaned.length > 32) {
      throw new BadRequestException('phone_invalid');
    }
    return cleaned;
  }

  private generateCode(): string {
    const pow = 10 ** PHONE_OTP_LENGTH;
    const min = 10 ** (PHONE_OTP_LENGTH - 1);
    const code = Math.floor(Math.random() * (pow - min)) + min;
    return String(code).padStart(PHONE_OTP_LENGTH, '0');
  }

  async requestOtp(accountId: string, rawPhone: string) {
    const phone = this.normalizePhone(rawPhone);
    const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MINUTES * 60 * 1000);
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, PHONE_OTP_SALT_ROUNDS);

    await this.tokens.delete({ accountId });
    await this.tokens.save(
      this.tokens.create({
        accountId,
        phone,
        codeHash,
        expiresAt,
      }),
    );

    await this.cleanupExpired();
    const sent = await this.sms.sendOtp(phone, code, PHONE_OTP_TTL_MINUTES);
    if (!sent) {
      throw new ServiceUnavailableException('otp_sms_failed');
    }
    return { phone };
  }

  async verifyOtp(accountId: string, rawPhone: string, code: string) {
    const phone = this.normalizePhone(rawPhone);
    const entry = await this.tokens.findOne({ where: { accountId } });
    if (!entry) {
      throw new UnauthorizedException('otp_not_found');
    }
    if (entry.phone !== phone) {
      throw new UnauthorizedException('otp_phone_mismatch');
    }
    if (entry.expiresAt.getTime() < Date.now()) {
      await this.tokens.delete(entry.id);
      throw new UnauthorizedException('otp_expired');
    }
    if (entry.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await this.tokens.delete(entry.id);
      throw new UnauthorizedException('otp_blocked');
    }
    const ok = await bcrypt.compare(code, entry.codeHash);
    if (!ok) {
      entry.attempts += 1;
      await this.tokens.save(entry);
      throw new UnauthorizedException('otp_invalid');
    }
    await this.tokens.delete(entry.id);
    await this.cleanupExpired();
    return { phone };
  }

  private async cleanupExpired() {
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
  }
}
