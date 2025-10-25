import { ConflictException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities';
import {
  RegisterCompanyDto,
  RegisterIndividualDto,
  LoginDto,
  UpdateCompanyProfileDto,
  UpdateIndividualProfileDto,
  RequestGmailOtpDto,
  VerifyGmailOtpDto,
} from './dto';
import { JwtService } from '@nestjs/jwt';
import { accountCreatedCounter, accountLoginCounter } from './metrics';
import * as bcrypt from 'bcryptjs';
import { OtpService } from './otp.service';
import { MailerService } from './mailer.service';

type SafeAccount = Omit<Account, 'passwordHash'>;

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly mailer: MailerService,
  ) {}

  private sanitize(account: Account): SafeAccount {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = account;
    return rest;
  }

  private sign(account: Account) {
    return this.jwt.sign({
      sub: account.id,
      email: account.email,
      type: account.type,
    });
  }

  private async ensureEmailAvailable(email: string) {
    const existing = await this.accounts.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('email_already_exists');
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private formatPreferences(preferences?: string[]): string[] | undefined {
    if (!preferences?.length) return undefined;
    const unique = Array.from(
      new Set(
        preferences
          .map((p) => p?.trim())
          .filter((p): p is string => Boolean(p)),
      ),
    );
    return unique.slice(0, 10);
  }

  private async hashPassword(password: string) {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  private async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  private buildResponse(account: Account) {
    return { token: this.sign(account), account: this.sanitize(account) };
  }

  async registerIndividual(dto: RegisterIndividualDto) {
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);

    const account = this.accounts.create({
      email,
      passwordHash: await this.hashPassword(dto.password),
      type: 'INDIVIDUAL',
      fullName: dto.fullName.trim(),
      comfortPreferences: this.formatPreferences(dto.comfortPreferences),
      tagline: dto.tagline?.trim() || null,
    });
    const saved = await this.accounts.save(account);
    accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
    await this.sendWelcomeEmail(saved);
    return this.buildResponse(saved);
  }

  async registerCompany(dto: RegisterCompanyDto) {
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);

    const account = this.accounts.create({
      email,
      passwordHash: await this.hashPassword(dto.password),
      type: 'COMPANY',
      companyName: dto.companyName.trim(),
      registrationNumber: dto.registrationNumber?.trim() || null,
      contactName: dto.contactName?.trim() || null,
      contactPhone: dto.contactPhone?.trim() || null,
    });
    const saved = await this.accounts.save(account);
    accountCreatedCounter.inc({ type: 'COMPANY' });
    await this.sendWelcomeEmail(saved);
    return this.buildResponse(saved);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const account = await this.accounts.findOne({ where: { email } });
    if (!account) {
      throw new UnauthorizedException('invalid_credentials');
    }
    const ok = await this.verifyPassword(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('invalid_credentials');
    }
    accountLoginCounter.inc({ type: account.type });
    return this.buildResponse(account);
  }

  async requestGmailOtp(dto: RequestGmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    await this.otp.requestOtp(email);
    return { success: true };
  }

  async verifyGmailOtp(dto: VerifyGmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const code = dto.code.trim();
    await this.otp.verifyOtp(email, code);

    let account = await this.accounts.findOne({ where: { email } });
    let created = false;
    if (!account) {
      account = this.accounts.create({
        email,
        passwordHash: await this.hashPassword(this.generateRandomPassword()),
        type: 'INDIVIDUAL',
        fullName: email.split('@')[0],
      });
      account = await this.accounts.save(account);
      accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
      created = true;
      await this.sendWelcomeEmail(account);
    }

    accountLoginCounter.inc({ type: account.type });
    return { ...this.buildResponse(account), created };
  }

  private generateRandomPassword() {
    return Math.random().toString(36).slice(-12);
  }

  async getProfile(accountId: string): Promise<SafeAccount | null> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    return account ? this.sanitize(account) : null;
  }

  async updateIndividualProfile(
    accountId: string,
    dto: UpdateIndividualProfileDto,
  ): Promise<SafeAccount> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account || account.type !== 'INDIVIDUAL') {
      throw new UnauthorizedException('invalid_account_type');
    }
    if (typeof dto.tagline === 'string') {
      account.tagline = dto.tagline.trim() || null;
    }
    if (dto.comfortPreferences) {
      account.comfortPreferences = this.formatPreferences(dto.comfortPreferences) ?? null;
    }
    const saved = await this.accounts.save(account);
    return this.sanitize(saved);
  }

  async updateCompanyProfile(
    accountId: string,
    dto: UpdateCompanyProfileDto,
  ): Promise<SafeAccount> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account || account.type !== 'COMPANY') {
      throw new UnauthorizedException('invalid_account_type');
    }
    if (typeof dto.companyName === 'string') {
      account.companyName = dto.companyName.trim();
    }
    if (typeof dto.registrationNumber === 'string') {
      account.registrationNumber = dto.registrationNumber.trim() || null;
    }
    if (typeof dto.contactName === 'string') {
      account.contactName = dto.contactName.trim() || null;
    }
    if (typeof dto.contactPhone === 'string') {
      account.contactPhone = dto.contactPhone.trim() || null;
    }
    const saved = await this.accounts.save(account);
    return this.sanitize(saved);
  }

  async getPublicProfile(accountId: string): Promise<SafeAccount | null> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    return account ? this.sanitize(account) : null;
  }

  async lookupByEmail(email: string): Promise<SafeAccount | null> {
    const normalized = this.normalizeEmail(email);
    const account = await this.accounts.findOne({ where: { email: normalized } });
    return account ? this.sanitize(account) : null;
  }

  private async sendWelcomeEmail(account: Account) {
    try {
      const displayName =
        account.type === 'COMPANY'
          ? account.companyName || account.contactName || 'equipe'
          : account.fullName || account.email.split('@')[0];
      const sent = await this.mailer.sendWelcomeEmail(account.email, {
        name: displayName,
        type: account.type,
      });
      if (!sent) {
        this.logger.warn(`Welcome email skipped for account ${account.id}`);
      }
    } catch (err) {
      this.logger.error(`Welcome email failed for account ${account.id}: ${(err as Error)?.message || err}`);
    }
  }
}
