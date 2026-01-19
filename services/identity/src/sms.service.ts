import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();

  async sendOtp(phone: string, code: string, ttlMinutes: number) {
    if (this.provider === 'console') {
      this.logger.warn(`[SMS OTP] ${phone} code=${code} ttl=${ttlMinutes}min`);
      return true;
    }

    // Placeholder for real provider (Twilio, Infobip, etc.)
    this.logger.warn(`[SMS OTP] Provider "${this.provider}" not configured.`);
    return false;
  }
}
