import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, Repository } from 'typeorm';
import {
  Account,
  AccountRole,
  AccountStatus,
  HomePreferences,
  PasswordResetToken,
  PaymentPreferences,
} from './entities';
import {
  RegisterCompanyDto,
  RegisterIndividualDto,
  LoginDto,
  UpdateCompanyProfileDto,
  UpdateIndividualProfileDto,
  RequestGmailOtpDto,
  VerifyGmailOtpDto,
  ListAccountsQueryDto,
  HomePreferencesDto,
  PaymentPreferencesDto,
  UpdateAccountProfileDto,
  HOME_THEME_OPTIONS,
  HOME_QUICK_ACTION_OPTIONS,
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from './dto';
import { JwtService } from '@nestjs/jwt';
import {
  accountCreatedCounter,
  accountLoginCounter,
  accountProfileUpdateCounter,
  accountStatusGauge,
  accountTypeGauge,
} from './metrics';
import * as bcrypt from 'bcryptjs';
import { OtpService } from './otp.service';
import { MailerService } from './mailer.service';
import { randomBytes } from 'crypto';
import axios from 'axios';

type SafeAccount = Omit<Account, 'passwordHash'>;

const PASSWORD_SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const PASSWORD_RESET_SECRET_BYTES = Number(process.env.PASSWORD_RESET_SECRET_BYTES || 32);
const PASSWORD_RESET_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5);
function looksLocalUrl(value?: string | null) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname?.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.startsWith('127.') ||
      host.startsWith('0.')
    );
  } catch {
    return false;
  }
}

function extractPort(value?: string | null) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.port || undefined;
  } catch {
    return undefined;
  }
}

const fallbackPort =
  process.env.APP_PUBLIC_PORT?.trim() ||
  extractPort(process.env.APP_BASE_URL?.trim()) ||
  extractPort(process.env.FRONTEND_URL?.trim()) ||
  '3006';

const DEFAULT_PUBLIC_URL = `${process.env.APP_PUBLIC_PROTOCOL || 'http'}://${
  process.env.APP_PUBLIC_HOST || '192.168.0.50'
}${fallbackPort ? `:${fallbackPort}` : ''}`;

const APP_PUBLIC_URL = (() => {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit;
  const appBase = process.env.APP_BASE_URL?.trim();
  if (appBase && !looksLocalUrl(appBase)) return appBase;
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend && !looksLocalUrl(frontend)) return frontend;
  return DEFAULT_PUBLIC_URL;
})();
const ACCOUNT_STATUS_VALUES: AccountStatus[] = ['ACTIVE', 'SUSPENDED'];
const ACCOUNT_ROLE_VALUES: AccountRole[] = ['USER', 'ADMIN'];
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${APP_PUBLIC_URL.replace(/\/$/, '')}/api/identity/auth/google/callback`,
  };
  private readonly oauthStates = new Map<
    string,
    {
      redirectOrigin: string;
      createdAt: number;
      provider: 'google' | 'mock';
    }
  >();
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly mailer: MailerService,
  ) {}

  async onModuleInit() {
    await this.refreshAccountMetrics();
  }

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
      role: account.role,
      status: account.status,
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

  private ensureAccountActive(account: Account) {
    if (account.status !== 'ACTIVE') {
      throw new ForbiddenException('account_suspended');
    }
  }

  private ensureValidStatus(status: AccountStatus) {
    if (!ACCOUNT_STATUS_VALUES.includes(status)) {
      throw new BadRequestException('invalid_status');
    }
  }

  private ensureValidRole(role: AccountRole) {
    if (!ACCOUNT_ROLE_VALUES.includes(role)) {
      throw new BadRequestException('invalid_role');
    }
  }

  private formatAccountDisplayName(account: Account) {
    return account.fullName || account.companyName || account.email;
  }

  private buildPasswordResetLink(token: string) {
    const base = APP_PUBLIC_URL || 'http://192.168.0.50';
    try {
      const url = new URL('/reset-password', base);
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      return `${base.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    }
  }

  private async cleanupExpiredResetTokens() {
    try {
      await this.resetTokens.delete({ expiresAt: LessThan(new Date()) });
    } catch (err) {
      this.logger.warn(`cleanupExpiredResetTokens failed: ${(err as Error)?.message ?? err}`);
    }
  }

  private normalizeProfilePhoto(url?: string | null, remove?: boolean): string | null {
    if (remove) return null;
    const trimmed = url?.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestException('invalid_photo_url');
    }
    return trimmed.slice(0, 1024);
  }

  private sanitizeHomePreferencesInput(input?: HomePreferencesDto | null): HomePreferences | null {
    if (!input) return null;
    const result: HomePreferences = {};

    if (Array.isArray(input.favoriteRoutes) && input.favoriteRoutes.length) {
      const items = input.favoriteRoutes
        .map((item) => ({
          from: item.from?.trim(),
          to: item.to?.trim(),
        }))
        .filter((item): item is { from: string; to: string } => Boolean(item.from) && Boolean(item.to))
        .slice(0, 5);
      if (items.length) {
        result.favoriteRoutes = items.map((item) => ({
          from: item.from.slice(0, 128),
          to: item.to.slice(0, 128),
        }));
      }
    }

    if (Array.isArray(input.quickActions) && input.quickActions.length) {
      const actions = input.quickActions
        .map((action) => action?.trim())
        .filter(
          (action): action is string =>
            Boolean(action) && (HOME_QUICK_ACTION_OPTIONS as readonly string[]).includes(action),
        )
        .slice(0, 6)
        .map((action) => action.slice(0, 64));
      if (actions.length) {
        result.quickActions = Array.from(new Set(actions));
      }
    }

    if (input.theme && HOME_THEME_OPTIONS.includes(input.theme)) {
      result.theme = input.theme;
    }

    if (typeof input.heroMessage === 'string') {
      const trimmed = input.heroMessage.trim();
      if (trimmed) {
        result.heroMessage = trimmed.slice(0, 160);
      }
    }

    if (typeof input.showTips === 'boolean') {
      result.showTips = input.showTips;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  private sanitizePaymentPreferencesInput(
    input?: PaymentPreferencesDto | null,
  ): PaymentPreferences | null {
    if (!input) return null;
    const defaultPaymentMethodId = input.defaultPaymentMethodId?.trim();
    if (!defaultPaymentMethodId) return null;
    return { defaultPaymentMethodId };
  }

  private async refreshAccountMetrics() {
    try {
      const typeRows = await this.accounts
        .createQueryBuilder('account')
        .select('account.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('account.type')
        .getRawMany();

      accountTypeGauge.reset();
      for (const type of ['INDIVIDUAL', 'COMPANY'] as const) {
        const row = typeRows.find((r) => r.type === type);
        accountTypeGauge.set({ type }, Number(row?.count ?? 0));
      }

      const statusRows = await this.accounts
        .createQueryBuilder('account')
        .select('account.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('account.status')
        .getRawMany();

      accountStatusGauge.reset();
      for (const status of ['ACTIVE', 'SUSPENDED'] as const) {
        const row = statusRows.find((r) => r.status === status);
        accountStatusGauge.set({ status }, Number(row?.count ?? 0));
      }
    } catch (err) {
      this.logger.error(`refreshAccountMetrics failed: ${(err as Error)?.message ?? err}`);
    }
  }

  private purgeOAuthStates() {
    const cutoff = Date.now() - OAUTH_STATE_TTL_MS;
    for (const [key, value] of this.oauthStates.entries()) {
      if (value.createdAt < cutoff) {
        this.oauthStates.delete(key);
      }
    }
  }

  private sanitizeRedirectOrigin(candidate?: string | null) {
    if (!candidate) return new URL(APP_PUBLIC_URL).origin;
    try {
      const base = new URL(APP_PUBLIC_URL);
      const url = new URL(candidate);
      return url.origin === base.origin ? url.origin : base.origin;
    } catch {
      return new URL(APP_PUBLIC_URL).origin;
    }
  }

  private createOAuthState(redirect?: string, provider: 'google' | 'mock' = 'google') {
    this.purgeOAuthStates();
    const state = randomBytes(16).toString('hex');
    this.oauthStates.set(state, {
      redirectOrigin: this.sanitizeRedirectOrigin(redirect),
      createdAt: Date.now(),
      provider,
    });
    return state;
  }

  private consumeOAuthState(value?: string | null) {
    if (!value) return undefined;
    const record = this.oauthStates.get(value);
    if (record) {
      this.oauthStates.delete(value);
    }
    return record;
  }

  isGoogleOAuthEnabled() {
    return Boolean(this.googleConfig.clientId && this.googleConfig.clientSecret);
  }

  getGoogleOAuthUrl(redirect?: string) {
    if (!this.isGoogleOAuthEnabled()) {
      throw new ServiceUnavailableException('google_oauth_disabled');
    }
    const state = this.createOAuthState(redirect, 'google');
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId!,
      redirect_uri: this.googleConfig.redirectUri!,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
      access_type: 'online',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  private buildOAuthResponseHtml(payload: { success: boolean; data?: any; error?: string; targetOrigin: string }) {
    const message = {
      type: 'kari:oauth',
      payload: payload.success ? payload.data : { error: payload.error || 'Connexion impossible.' },
    };
    const serialized = JSON.stringify(message);
    const target = JSON.stringify(payload.targetOrigin || APP_PUBLIC_URL);
    const fallbackText = payload.success
      ? 'Connexion réussie. Tu peux fermer cette fenêtre.'
      : payload.error || 'Connexion impossible. Ferme cette fenêtre.';
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><title>Connexion KariGo</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center;">
<p>${fallbackText}</p>
<script>
(function(){
  try {
    var payload = ${serialized};
    var origin = ${target};
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, origin);
      window.close();
    }
  } catch (err) {
    console.error('oauth popup error', err);
  }
})();
</script>
</body></html>`;
  }

  async handleGoogleOAuthCallback(params: { code?: string; state?: string; error?: string }) {
    const stateRecord = this.consumeOAuthState(params.state);
    const targetOrigin = stateRecord?.redirectOrigin || new URL(APP_PUBLIC_URL).origin;
    if (!stateRecord || stateRecord.provider !== 'google') {
      return this.buildOAuthResponseHtml({
        success: false,
        error: 'state_invalid',
        targetOrigin,
      });
    }
    if (!this.isGoogleOAuthEnabled()) {
      return this.buildOAuthResponseHtml({
        success: false,
        error: 'google_oauth_disabled',
        targetOrigin,
      });
    }
    if (params.error) {
      return this.buildOAuthResponseHtml({
        success: false,
        error: params.error,
        targetOrigin,
      });
    }
    if (!params.code) {
      return this.buildOAuthResponseHtml({
        success: false,
        error: 'code_absent',
        targetOrigin,
      });
    }
    try {
      const tokenRes = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          code: params.code,
          client_id: this.googleConfig.clientId!,
          client_secret: this.googleConfig.clientSecret!,
          redirect_uri: this.googleConfig.redirectUri!,
          grant_type: 'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const accessToken = tokenRes.data?.access_token;
      if (!accessToken) {
        throw new ServiceUnavailableException('google_token_failed');
      }
      const profileRes = await axios.get(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = profileRes.data;
      const email = profile?.email?.toLowerCase();
      if (!email) {
        throw new UnauthorizedException('google_email_missing');
      }
      if (profile.email_verified === false) {
        throw new ForbiddenException('google_email_unverified');
      }
      const result = await this.upsertOAuthAccount(email, profile?.name);
      return this.buildOAuthResponseHtml({
        success: true,
        targetOrigin,
        data: result,
      });
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'google_oauth_failed';
      this.logger.error(`Google OAuth callback error: ${message}`);
      return this.buildOAuthResponseHtml({
        success: false,
        targetOrigin,
        error: message,
      });
    }
  }

  private async upsertOAuthAccount(email: string, displayName?: string) {
    const normalized = this.normalizeEmail(email);
    let account = await this.accounts.findOne({ where: { email: normalized } });
    if (!account) {
      const pwd = await this.hashPassword(randomBytes(12).toString('hex'));
      account = this.accounts.create({
        email: normalized,
        passwordHash: pwd,
        fullName: displayName ?? undefined,
        type: 'INDIVIDUAL',
        role: 'USER',
        status: 'ACTIVE',
      });
      account = await this.accounts.save(account);
      accountCreatedCounter.inc({ type: account.type });
    } else if (!account.fullName && displayName) {
      account.fullName = displayName;
      await this.accounts.save(account);
    }
    this.ensureAccountActive(account);
    const token = this.sign(account);
    accountLoginCounter.inc({ type: account.type });
    return { token, account: this.sanitize(account) };
  }

  startMockGoogleFlow(redirect?: string) {
    const state = this.createOAuthState(redirect, 'mock');
    const submitUrl = `${APP_PUBLIC_URL.replace(/\/$/, '')}/api/identity/auth/google/mock/complete`;
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><title>Connexion KariGo</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f4f4f4;margin:0;padding:24px;} .card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 12px 35px rgba(15,23,42,.15);} label{font-size:13px;color:#475569;font-weight:600;} input{width:100%;font-size:15px;margin-top:8px;padding:10px 14px;border-radius:12px;border:1px solid #cbd5f5;} button{width:100%;margin-top:16px;background:#0c6efd;border:none;color:#fff;font-weight:600;padding:12px;border-radius:999px;font-size:15px;cursor:pointer;} .header{display:flex;align-items:center;gap:12px;margin-bottom:16px;} .logo{width:36px;height:36px;border-radius:12px;background:#0c6efd;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;} </style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">K</div>
    <div>
      <div style="font-weight:600;font-size:16px;">Connexion KariGo</div>
      <div style="font-size:13px;color:#475569;">Confirme ton email pour continuer</div>
    </div>
  </div>
  <form method="POST" action="${submitUrl}">
    <input type="hidden" name="state" value="${state}" />
    <label>Email</label>
    <input type="email" name="email" placeholder="prenom@gmail.com" required />
    <button type="submit">Autoriser l’accès</button>
  </form>
</div>
</body></html>`;
  }

  async completeMockGoogle(params: { state?: string; email?: string }) {
    const stateRecord = this.consumeOAuthState(params.state);
    const targetOrigin = stateRecord?.redirectOrigin || new URL(APP_PUBLIC_URL).origin;
    if (!stateRecord || stateRecord.provider !== 'mock') {
      return this.buildOAuthResponseHtml({
        success: false,
        error: 'state_invalid',
        targetOrigin,
      });
    }
    const email = params.email?.trim().toLowerCase();
    if (!email) {
      return this.buildOAuthResponseHtml({
        success: false,
        error: 'email_requis',
        targetOrigin,
      });
    }
    try {
      const result = await this.upsertOAuthAccount(email, email.split('@')[0]);
      return this.buildOAuthResponseHtml({
        success: true,
        targetOrigin,
        data: result,
      });
    } catch (err: any) {
      return this.buildOAuthResponseHtml({
        success: false,
        targetOrigin,
        error: err?.message || 'mock_oauth_failed',
      });
    }
  }

  private async recordSuccessfulLogin(account: Account) {
    account.lastLoginAt = new Date();
    account.loginCount = (account.loginCount ?? 0) + 1;
    return this.accounts.save(account);
  }

  private async ensureAdminBootstrap(account: Account) {
    const adminCount = await this.accounts.count({ where: { role: 'ADMIN' } });
    if (adminCount === 0) {
      account.role = 'ADMIN';
      this.logger.log(`Bootstrap: promoted ${account.email} to ADMIN`);
    }
  }

  private buildStats(
    statusRaw: Array<{ status: AccountStatus; count: string }>,
    roleRaw: Array<{ role: AccountRole; count: string }>,
  ) {
    const byStatus: Record<AccountStatus, number> = { ACTIVE: 0, SUSPENDED: 0 };
    for (const row of statusRaw ?? []) {
      if (!row?.status) continue;
      const value = row.status as AccountStatus;
      if (ACCOUNT_STATUS_VALUES.includes(value)) {
        byStatus[value] = Number(row.count) || 0;
      }
    }

    const byRole: Record<AccountRole, number> = { USER: 0, ADMIN: 0 };
    for (const row of roleRaw ?? []) {
      if (!row?.role) continue;
      const value = row.role as AccountRole;
      if (ACCOUNT_ROLE_VALUES.includes(value)) {
        byRole[value] = Number(row.count) || 0;
      }
    }
    return { byStatus, byRole };
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
      role: 'USER',
      status: 'ACTIVE',
      loginCount: 0,
      profilePhotoUrl: null,
      homePreferences: null,
    });
    await this.ensureAdminBootstrap(account);
    const saved = await this.accounts.save(account);
    const logged = await this.recordSuccessfulLogin(saved);
    accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
    accountLoginCounter.inc({ type: 'INDIVIDUAL' });
    await this.sendWelcomeEmail(logged);
    await this.refreshAccountMetrics();
    return this.buildResponse(logged);
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
      role: 'USER',
      status: 'ACTIVE',
      loginCount: 0,
      profilePhotoUrl: null,
      homePreferences: null,
    });
    await this.ensureAdminBootstrap(account);
    const saved = await this.accounts.save(account);
    const logged = await this.recordSuccessfulLogin(saved);
    accountCreatedCounter.inc({ type: 'COMPANY' });
    accountLoginCounter.inc({ type: 'COMPANY' });
    await this.sendWelcomeEmail(logged);
    await this.refreshAccountMetrics();
    return this.buildResponse(logged);
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
    this.ensureAccountActive(account);
    const logged = await this.recordSuccessfulLogin(account);
    accountLoginCounter.inc({ type: logged.type });
    return this.buildResponse(logged);
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
        role: 'USER',
        status: 'ACTIVE',
        loginCount: 0,
        profilePhotoUrl: null,
        homePreferences: null,
      });
      await this.ensureAdminBootstrap(account);
      account = await this.accounts.save(account);
      accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
      created = true;
      await this.sendWelcomeEmail(account);
      await this.refreshAccountMetrics();
    } else {
      this.ensureAccountActive(account);
    }

    const logged = await this.recordSuccessfulLogin(account);
    accountLoginCounter.inc({ type: logged.type });
    return { ...this.buildResponse(logged), created };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    const account = await this.accounts.findOne({ where: { email } });
    if (!account) {
      await this.cleanupExpiredResetTokens();
      return { success: true };
    }

    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
    const secretBytes = Math.max(16, PASSWORD_RESET_SECRET_BYTES);
    const secret = randomBytes(secretBytes).toString('hex');
    const secretHash = await bcrypt.hash(secret, 8);

    await this.resetTokens.delete({ accountId: account.id });
    const saved = await this.resetTokens.save(
      this.resetTokens.create({
        accountId: account.id,
        email,
        secretHash,
        expiresAt,
      }),
    );

    const token = `${saved.id}:${secret}`;
    const resetUrl = this.buildPasswordResetLink(token);
    const sent = await this.mailer.sendPasswordResetEmail(account.email, {
      name: this.formatAccountDisplayName(account),
      resetUrl,
      expiresAt,
    });
    if (!sent) {
      throw new ServiceUnavailableException('reset_email_failed');
    }
    await this.cleanupExpiredResetTokens();
    return { success: true };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const rawToken = dto.token?.trim();
    if (!rawToken || !rawToken.includes(':')) {
      throw new BadRequestException('invalid_token');
    }
    const [id, secret] = rawToken.split(':');
    if (!id || !secret) {
      throw new BadRequestException('invalid_token');
    }

    const entry = await this.resetTokens.findOne({ where: { id } });
    if (!entry) {
      throw new UnauthorizedException('reset_invalid');
    }
    if (entry.usedAt) {
      throw new UnauthorizedException('reset_used');
    }
    if (entry.expiresAt.getTime() < Date.now()) {
      await this.resetTokens.delete(entry.id);
      throw new UnauthorizedException('reset_expired');
    }
    if (entry.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await this.resetTokens.delete(entry.id);
      throw new UnauthorizedException('reset_blocked');
    }

    const ok = await bcrypt.compare(secret, entry.secretHash);
    if (!ok) {
      entry.attempts += 1;
      if (entry.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
        await this.resetTokens.delete(entry.id);
      } else {
        await this.resetTokens.save(entry);
      }
      throw new UnauthorizedException('reset_invalid');
    }

    const account = await this.accounts.findOne({ where: { id: entry.accountId } });
    if (!account) {
      await this.resetTokens.delete(entry.id);
      throw new NotFoundException('account_not_found');
    }
    this.ensureAccountActive(account);

    account.passwordHash = await this.hashPassword(dto.password);
    const savedAccount = await this.accounts.save(account);
    entry.usedAt = new Date();
    entry.attempts += 1;
    await this.resetTokens.save(entry);
    await this.resetTokens.delete({ accountId: entry.accountId, id: Not(entry.id) });
    await this.cleanupExpiredResetTokens();

    const logged = await this.recordSuccessfulLogin(savedAccount);
    accountLoginCounter.inc({ type: logged.type });
    return this.buildResponse(logged);
  }

  private generateRandomPassword() {
    return Math.random().toString(36).slice(-12);
  }

  async getProfile(accountId: string): Promise<SafeAccount | null> {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    return account ? this.sanitize(account) : null;
  }

  async getProfiles(accountIds: string[]): Promise<SafeAccount[]> {
    const ids = Array.from(
      new Set(
        accountIds
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ).slice(0, 500);
    if (!ids.length) {
      return [];
    }
    const accounts = await this.accounts.find({ where: { id: In(ids) } });
    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    return ids
      .map((id) => accountMap.get(id))
      .filter((account): account is Account => Boolean(account))
      .map((account) => this.sanitize(account));
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
    if (dto.removeTagline) {
      account.tagline = null;
    }
    if (dto.comfortPreferences) {
      account.comfortPreferences = this.formatPreferences(dto.comfortPreferences) ?? null;
    }
    if (dto.profilePhotoUrl !== undefined || dto.removeProfilePhoto) {
      account.profilePhotoUrl = this.normalizeProfilePhoto(dto.profilePhotoUrl, dto.removeProfilePhoto);
    }
    if (dto.homePreferences !== undefined) {
      account.homePreferences = this.sanitizeHomePreferencesInput(dto.homePreferences) ?? null;
    }
    if (dto.paymentPreferences !== undefined) {
      account.paymentPreferences = this.sanitizePaymentPreferencesInput(dto.paymentPreferences) ?? null;
    }
    const saved = await this.accounts.save(account);
    accountProfileUpdateCounter.inc({ actor: 'self', type: 'INDIVIDUAL' });
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
    if (dto.removeTagline) {
      account.tagline = null;
    } else if (typeof dto.tagline === 'string') {
      account.tagline = dto.tagline.trim() || null;
    }
    if (dto.profilePhotoUrl !== undefined || dto.removeProfilePhoto) {
      account.profilePhotoUrl = this.normalizeProfilePhoto(dto.profilePhotoUrl, dto.removeProfilePhoto);
    }
    if (dto.homePreferences !== undefined) {
      account.homePreferences = this.sanitizeHomePreferencesInput(dto.homePreferences) ?? null;
    }
    if (dto.paymentPreferences !== undefined) {
      account.paymentPreferences = this.sanitizePaymentPreferencesInput(dto.paymentPreferences) ?? null;
    }
    const saved = await this.accounts.save(account);
    accountProfileUpdateCounter.inc({ actor: 'self', type: 'COMPANY' });
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

  async adminUpdateAccountProfile(id: string, dto: UpdateAccountProfileDto) {
    const trimmed = id?.trim();
    if (!trimmed) {
      throw new BadRequestException('id_required');
    }
    const account = await this.accounts.findOne({ where: { id: trimmed } });
    if (!account) {
      throw new NotFoundException('account_not_found');
    }

    if (dto.fullName && account.type === 'INDIVIDUAL') {
      account.fullName = dto.fullName.trim();
    }
    if (dto.removeTagline) {
      account.tagline = null;
    } else if (dto.tagline !== undefined) {
      account.tagline = dto.tagline.trim() || null;
    }
    if (dto.comfortPreferences && account.type === 'INDIVIDUAL') {
      account.comfortPreferences = this.formatPreferences(dto.comfortPreferences) ?? null;
    }

    if (account.type === 'COMPANY') {
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
    }

    if (dto.profilePhotoUrl !== undefined || dto.removeProfilePhoto) {
      account.profilePhotoUrl = this.normalizeProfilePhoto(dto.profilePhotoUrl, dto.removeProfilePhoto);
    }

    if (dto.homePreferences !== undefined) {
      account.homePreferences = this.sanitizeHomePreferencesInput(dto.homePreferences) ?? null;
    }
    if (dto.paymentPreferences !== undefined) {
      account.paymentPreferences = this.sanitizePaymentPreferencesInput(dto.paymentPreferences) ?? null;
    }

    const saved = await this.accounts.save(account);
    accountProfileUpdateCounter.inc({ actor: 'admin', type: account.type });
    return this.sanitize(saved);
  }

  async listAccounts(query: ListAccountsQueryDto) {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const qb = this.accounts.createQueryBuilder('account');

    if (query.status) {
      qb.andWhere('account.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('account.type = :type', { type: query.type });
    }
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      qb.andWhere(
        '(account.email ILIKE :pattern OR account.fullName ILIKE :pattern OR account.companyName ILIKE :pattern)',
        { pattern },
      );
    }

    qb.orderBy('account.createdAt', 'DESC');
    qb.skip(offset);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    const [statusCountsRaw, roleCountsRaw] = await Promise.all([
      this.accounts
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.status')
        .getRawMany(),
      this.accounts
        .createQueryBuilder('a')
        .select('a.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.role')
        .getRawMany(),
    ]);

    const stats = this.buildStats(statusCountsRaw as any, roleCountsRaw as any);

    return {
      data: items.map((item) => this.sanitize(item)),
      total,
      offset,
      limit,
      filters: {
        status: query.status ?? null,
        type: query.type ?? null,
        search: search || null,
      },
      stats,
    };
  }

  async updateAccountStatus(id: string, status: AccountStatus, actorId?: string) {
    this.ensureValidStatus(status);
    const trimmed = id?.trim();
    if (!trimmed) {
      throw new BadRequestException('id_required');
    }
    const account = await this.accounts.findOne({ where: { id: trimmed } });
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    if (actorId && actorId === account.id && status !== 'ACTIVE') {
      throw new BadRequestException('cannot_suspend_self');
    }
    if (account.role === 'ADMIN' && status !== 'ACTIVE') {
      const otherAdmins = await this.accounts.count({
        where: { role: 'ADMIN', status: 'ACTIVE', id: Not(account.id) },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('cannot_suspend_last_admin');
      }
    }
    if (account.status === status) {
      return this.sanitize(account);
    }
    account.status = status;
    const saved = await this.accounts.save(account);
    await this.refreshAccountMetrics();
    return this.sanitize(saved);
  }

  async updateAccountRole(id: string, role: AccountRole, actorId?: string) {
    this.ensureValidRole(role);
    const trimmed = id?.trim();
    if (!trimmed) {
      throw new BadRequestException('id_required');
    }
    const account = await this.accounts.findOne({ where: { id: trimmed } });
    if (!account) {
      throw new NotFoundException('account_not_found');
    }
    if (actorId && actorId === account.id && role !== 'ADMIN') {
      throw new BadRequestException('cannot_demote_self');
    }
    if (account.role === 'ADMIN' && role !== 'ADMIN') {
      const otherAdmins = await this.accounts.count({ where: { role: 'ADMIN', id: Not(account.id) } });
      if (otherAdmins === 0) {
        throw new BadRequestException('cannot_remove_last_admin');
      }
    }
    if (account.role === role) {
      return this.sanitize(account);
    }
    account.role = role;
    const saved = await this.accounts.save(account);
    return this.sanitize(saved);
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
