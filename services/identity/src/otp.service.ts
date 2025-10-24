import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OtpToken } from './entities';
import * as bcrypt from 'bcryptjs';
import { MailerService } from './mailer.service';

const OTP_TTL_MINUTES = Number(process.env.GMAIL_OTP_TTL_MINUTES || 10);
const OTP_LENGTH = Number(process.env.GMAIL_OTP_LENGTH || 6);
const OTP_SALT_ROUNDS = 6;
const OTP_MAX_ATTEMPTS = Number(process.env.GMAIL_OTP_MAX_ATTEMPTS || 5);

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpToken) private readonly tokens: Repository<OtpToken>,
    private readonly mailer: MailerService,
  ) {}

  private assertGmail(email: string) {
    if (!email.endsWith('@gmail.com')) {
      throw new BadRequestException('gmail_only');
    }
  }

  private generateCode(): string {
    const pow = 10 ** OTP_LENGTH;
    const min = 10 ** (OTP_LENGTH - 1);
    const code = Math.floor(Math.random() * (pow - min)) + min;
    return String(code).padStart(OTP_LENGTH, '0');
  }

  async requestOtp(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    this.assertGmail(email);

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);

    await this.tokens.delete({ email });
    await this.tokens.save(
      this.tokens.create({
        email,
        codeHash,
        expiresAt,
      }),
    );

    await this.cleanupExpired();
    const sent = await this.mailer.sendOtpEmail(email, code, OTP_TTL_MINUTES);
    if (!sent) {
      throw new ServiceUnavailableException('otp_email_failed');
    }
  }

  async verifyOtp(rawEmail: string, code: string) {
    const email = rawEmail.trim().toLowerCase();
    this.assertGmail(email);

    const entry = await this.tokens.findOne({ where: { email } });
    if (!entry) throw new UnauthorizedException('otp_not_found');

    if (entry.expiresAt.getTime() < Date.now()) {
      await this.tokens.delete(entry.id);
      throw new UnauthorizedException('otp_expired');
    }

    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
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
  }

  private async cleanupExpired() {
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
  }
}
