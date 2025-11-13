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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const dto_1 = require("./dto");
const jwt_1 = require("@nestjs/jwt");
const metrics_1 = require("./metrics");
const bcrypt = __importStar(require("bcryptjs"));
const otp_service_1 = require("./otp.service");
const mailer_service_1 = require("./mailer.service");
const crypto_1 = require("crypto");
const PASSWORD_SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const PASSWORD_RESET_SECRET_BYTES = Number(process.env.PASSWORD_RESET_SECRET_BYTES || 32);
const PASSWORD_RESET_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5);
function looksLocalUrl(value) {
    if (!value)
        return false;
    try {
        const parsed = new URL(value);
        const host = parsed.hostname?.toLowerCase();
        return (host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '0.0.0.0' ||
            host === '[::1]' ||
            host.startsWith('127.') ||
            host.startsWith('0.'));
    }
    catch {
        return false;
    }
}
function extractPort(value) {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value);
        return parsed.port || undefined;
    }
    catch {
        return undefined;
    }
}
const fallbackPort = process.env.APP_PUBLIC_PORT?.trim() ||
    extractPort(process.env.APP_BASE_URL?.trim()) ||
    extractPort(process.env.FRONTEND_URL?.trim()) ||
    '3006';
const DEFAULT_PUBLIC_URL = `${process.env.APP_PUBLIC_PROTOCOL || 'http'}://${process.env.APP_PUBLIC_HOST || '192.168.0.50'}${fallbackPort ? `:${fallbackPort}` : ''}`;
const APP_PUBLIC_URL = (() => {
    const explicit = process.env.APP_PUBLIC_URL?.trim();
    if (explicit)
        return explicit;
    const appBase = process.env.APP_BASE_URL?.trim();
    if (appBase && !looksLocalUrl(appBase))
        return appBase;
    const frontend = process.env.FRONTEND_URL?.trim();
    if (frontend && !looksLocalUrl(frontend))
        return frontend;
    return DEFAULT_PUBLIC_URL;
})();
const ACCOUNT_STATUS_VALUES = ['ACTIVE', 'SUSPENDED'];
const ACCOUNT_ROLE_VALUES = ['USER', 'ADMIN'];
let AuthService = AuthService_1 = class AuthService {
    constructor(accounts, resetTokens, jwt, otp, mailer) {
        this.accounts = accounts;
        this.resetTokens = resetTokens;
        this.jwt = jwt;
        this.otp = otp;
        this.mailer = mailer;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async onModuleInit() {
        await this.refreshAccountMetrics();
    }
    sanitize(account) {
        const { passwordHash, ...rest } = account;
        return rest;
    }
    sign(account) {
        return this.jwt.sign({
            sub: account.id,
            email: account.email,
            type: account.type,
            role: account.role,
            status: account.status,
        });
    }
    async ensureEmailAvailable(email) {
        const existing = await this.accounts.findOne({ where: { email } });
        if (existing) {
            throw new common_1.ConflictException('email_already_exists');
        }
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    formatPreferences(preferences) {
        if (!preferences?.length)
            return undefined;
        const unique = Array.from(new Set(preferences
            .map((p) => p?.trim())
            .filter((p) => Boolean(p))));
        return unique.slice(0, 10);
    }
    async hashPassword(password) {
        return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    }
    async verifyPassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    ensureAccountActive(account) {
        if (account.status !== 'ACTIVE') {
            throw new common_1.ForbiddenException('account_suspended');
        }
    }
    ensureValidStatus(status) {
        if (!ACCOUNT_STATUS_VALUES.includes(status)) {
            throw new common_1.BadRequestException('invalid_status');
        }
    }
    ensureValidRole(role) {
        if (!ACCOUNT_ROLE_VALUES.includes(role)) {
            throw new common_1.BadRequestException('invalid_role');
        }
    }
    formatAccountDisplayName(account) {
        return account.fullName || account.companyName || account.email;
    }
    buildPasswordResetLink(token) {
        const base = APP_PUBLIC_URL || 'http://192.168.0.50';
        try {
            const url = new URL('/reset-password', base);
            url.searchParams.set('token', token);
            return url.toString();
        }
        catch {
            return `${base.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
        }
    }
    async cleanupExpiredResetTokens() {
        try {
            await this.resetTokens.delete({ expiresAt: (0, typeorm_2.LessThan)(new Date()) });
        }
        catch (err) {
            this.logger.warn(`cleanupExpiredResetTokens failed: ${err?.message ?? err}`);
        }
    }
    normalizeProfilePhoto(url, remove) {
        if (remove)
            return null;
        const trimmed = url?.trim();
        if (!trimmed)
            return null;
        if (!/^https?:\/\//i.test(trimmed)) {
            throw new common_1.BadRequestException('invalid_photo_url');
        }
        return trimmed.slice(0, 1024);
    }
    sanitizeHomePreferencesInput(input) {
        if (!input)
            return null;
        const result = {};
        if (Array.isArray(input.favoriteRoutes) && input.favoriteRoutes.length) {
            const items = input.favoriteRoutes
                .map((item) => ({
                from: item.from?.trim(),
                to: item.to?.trim(),
            }))
                .filter((item) => Boolean(item.from) && Boolean(item.to))
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
                .filter((action) => Boolean(action) && dto_1.HOME_QUICK_ACTION_OPTIONS.includes(action))
                .slice(0, 6)
                .map((action) => action.slice(0, 64));
            if (actions.length) {
                result.quickActions = Array.from(new Set(actions));
            }
        }
        if (input.theme && dto_1.HOME_THEME_OPTIONS.includes(input.theme)) {
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
    async refreshAccountMetrics() {
        try {
            const typeRows = await this.accounts
                .createQueryBuilder('account')
                .select('account.type', 'type')
                .addSelect('COUNT(*)', 'count')
                .groupBy('account.type')
                .getRawMany();
            metrics_1.accountTypeGauge.reset();
            for (const type of ['INDIVIDUAL', 'COMPANY']) {
                const row = typeRows.find((r) => r.type === type);
                metrics_1.accountTypeGauge.set({ type }, Number(row?.count ?? 0));
            }
            const statusRows = await this.accounts
                .createQueryBuilder('account')
                .select('account.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .groupBy('account.status')
                .getRawMany();
            metrics_1.accountStatusGauge.reset();
            for (const status of ['ACTIVE', 'SUSPENDED']) {
                const row = statusRows.find((r) => r.status === status);
                metrics_1.accountStatusGauge.set({ status }, Number(row?.count ?? 0));
            }
        }
        catch (err) {
            this.logger.error(`refreshAccountMetrics failed: ${err?.message ?? err}`);
        }
    }
    async recordSuccessfulLogin(account) {
        account.lastLoginAt = new Date();
        account.loginCount = (account.loginCount ?? 0) + 1;
        return this.accounts.save(account);
    }
    async ensureAdminBootstrap(account) {
        const adminCount = await this.accounts.count({ where: { role: 'ADMIN' } });
        if (adminCount === 0) {
            account.role = 'ADMIN';
            this.logger.log(`Bootstrap: promoted ${account.email} to ADMIN`);
        }
    }
    buildStats(statusRaw, roleRaw) {
        const byStatus = { ACTIVE: 0, SUSPENDED: 0 };
        for (const row of statusRaw ?? []) {
            if (!row?.status)
                continue;
            const value = row.status;
            if (ACCOUNT_STATUS_VALUES.includes(value)) {
                byStatus[value] = Number(row.count) || 0;
            }
        }
        const byRole = { USER: 0, ADMIN: 0 };
        for (const row of roleRaw ?? []) {
            if (!row?.role)
                continue;
            const value = row.role;
            if (ACCOUNT_ROLE_VALUES.includes(value)) {
                byRole[value] = Number(row.count) || 0;
            }
        }
        return { byStatus, byRole };
    }
    buildResponse(account) {
        return { token: this.sign(account), account: this.sanitize(account) };
    }
    async registerIndividual(dto) {
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
        metrics_1.accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
        metrics_1.accountLoginCounter.inc({ type: 'INDIVIDUAL' });
        await this.sendWelcomeEmail(logged);
        await this.refreshAccountMetrics();
        return this.buildResponse(logged);
    }
    async registerCompany(dto) {
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
        metrics_1.accountCreatedCounter.inc({ type: 'COMPANY' });
        metrics_1.accountLoginCounter.inc({ type: 'COMPANY' });
        await this.sendWelcomeEmail(logged);
        await this.refreshAccountMetrics();
        return this.buildResponse(logged);
    }
    async login(dto) {
        const email = this.normalizeEmail(dto.email);
        const account = await this.accounts.findOne({ where: { email } });
        if (!account) {
            throw new common_1.UnauthorizedException('invalid_credentials');
        }
        const ok = await this.verifyPassword(dto.password, account.passwordHash);
        if (!ok) {
            throw new common_1.UnauthorizedException('invalid_credentials');
        }
        this.ensureAccountActive(account);
        const logged = await this.recordSuccessfulLogin(account);
        metrics_1.accountLoginCounter.inc({ type: logged.type });
        return this.buildResponse(logged);
    }
    async requestGmailOtp(dto) {
        const email = this.normalizeEmail(dto.email);
        await this.otp.requestOtp(email);
        return { success: true };
    }
    async verifyGmailOtp(dto) {
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
            metrics_1.accountCreatedCounter.inc({ type: 'INDIVIDUAL' });
            created = true;
            await this.sendWelcomeEmail(account);
            await this.refreshAccountMetrics();
        }
        else {
            this.ensureAccountActive(account);
        }
        const logged = await this.recordSuccessfulLogin(account);
        metrics_1.accountLoginCounter.inc({ type: logged.type });
        return { ...this.buildResponse(logged), created };
    }
    async requestPasswordReset(dto) {
        const email = this.normalizeEmail(dto.email);
        const account = await this.accounts.findOne({ where: { email } });
        if (!account) {
            await this.cleanupExpiredResetTokens();
            return { success: true };
        }
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
        const secretBytes = Math.max(16, PASSWORD_RESET_SECRET_BYTES);
        const secret = (0, crypto_1.randomBytes)(secretBytes).toString('hex');
        const secretHash = await bcrypt.hash(secret, 8);
        await this.resetTokens.delete({ accountId: account.id });
        const saved = await this.resetTokens.save(this.resetTokens.create({
            accountId: account.id,
            email,
            secretHash,
            expiresAt,
        }));
        const token = `${saved.id}:${secret}`;
        const resetUrl = this.buildPasswordResetLink(token);
        const sent = await this.mailer.sendPasswordResetEmail(account.email, {
            name: this.formatAccountDisplayName(account),
            resetUrl,
            expiresAt,
        });
        if (!sent) {
            throw new common_1.ServiceUnavailableException('reset_email_failed');
        }
        await this.cleanupExpiredResetTokens();
        return { success: true };
    }
    async confirmPasswordReset(dto) {
        const rawToken = dto.token?.trim();
        if (!rawToken || !rawToken.includes(':')) {
            throw new common_1.BadRequestException('invalid_token');
        }
        const [id, secret] = rawToken.split(':');
        if (!id || !secret) {
            throw new common_1.BadRequestException('invalid_token');
        }
        const entry = await this.resetTokens.findOne({ where: { id } });
        if (!entry) {
            throw new common_1.UnauthorizedException('reset_invalid');
        }
        if (entry.usedAt) {
            throw new common_1.UnauthorizedException('reset_used');
        }
        if (entry.expiresAt.getTime() < Date.now()) {
            await this.resetTokens.delete(entry.id);
            throw new common_1.UnauthorizedException('reset_expired');
        }
        if (entry.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
            await this.resetTokens.delete(entry.id);
            throw new common_1.UnauthorizedException('reset_blocked');
        }
        const ok = await bcrypt.compare(secret, entry.secretHash);
        if (!ok) {
            entry.attempts += 1;
            if (entry.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
                await this.resetTokens.delete(entry.id);
            }
            else {
                await this.resetTokens.save(entry);
            }
            throw new common_1.UnauthorizedException('reset_invalid');
        }
        const account = await this.accounts.findOne({ where: { id: entry.accountId } });
        if (!account) {
            await this.resetTokens.delete(entry.id);
            throw new common_1.NotFoundException('account_not_found');
        }
        this.ensureAccountActive(account);
        account.passwordHash = await this.hashPassword(dto.password);
        const savedAccount = await this.accounts.save(account);
        entry.usedAt = new Date();
        entry.attempts += 1;
        await this.resetTokens.save(entry);
        await this.resetTokens.delete({ accountId: entry.accountId, id: (0, typeorm_2.Not)(entry.id) });
        await this.cleanupExpiredResetTokens();
        const logged = await this.recordSuccessfulLogin(savedAccount);
        metrics_1.accountLoginCounter.inc({ type: logged.type });
        return this.buildResponse(logged);
    }
    generateRandomPassword() {
        return Math.random().toString(36).slice(-12);
    }
    async getProfile(accountId) {
        const account = await this.accounts.findOne({ where: { id: accountId } });
        return account ? this.sanitize(account) : null;
    }
    async updateIndividualProfile(accountId, dto) {
        const account = await this.accounts.findOne({ where: { id: accountId } });
        if (!account || account.type !== 'INDIVIDUAL') {
            throw new common_1.UnauthorizedException('invalid_account_type');
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
        const saved = await this.accounts.save(account);
        metrics_1.accountProfileUpdateCounter.inc({ actor: 'self', type: 'INDIVIDUAL' });
        return this.sanitize(saved);
    }
    async updateCompanyProfile(accountId, dto) {
        const account = await this.accounts.findOne({ where: { id: accountId } });
        if (!account || account.type !== 'COMPANY') {
            throw new common_1.UnauthorizedException('invalid_account_type');
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
        }
        else if (typeof dto.tagline === 'string') {
            account.tagline = dto.tagline.trim() || null;
        }
        if (dto.profilePhotoUrl !== undefined || dto.removeProfilePhoto) {
            account.profilePhotoUrl = this.normalizeProfilePhoto(dto.profilePhotoUrl, dto.removeProfilePhoto);
        }
        if (dto.homePreferences !== undefined) {
            account.homePreferences = this.sanitizeHomePreferencesInput(dto.homePreferences) ?? null;
        }
        const saved = await this.accounts.save(account);
        metrics_1.accountProfileUpdateCounter.inc({ actor: 'self', type: 'COMPANY' });
        return this.sanitize(saved);
    }
    async getPublicProfile(accountId) {
        const account = await this.accounts.findOne({ where: { id: accountId } });
        return account ? this.sanitize(account) : null;
    }
    async lookupByEmail(email) {
        const normalized = this.normalizeEmail(email);
        const account = await this.accounts.findOne({ where: { email: normalized } });
        return account ? this.sanitize(account) : null;
    }
    async adminUpdateAccountProfile(id, dto) {
        const trimmed = id?.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('id_required');
        }
        const account = await this.accounts.findOne({ where: { id: trimmed } });
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        if (dto.fullName && account.type === 'INDIVIDUAL') {
            account.fullName = dto.fullName.trim();
        }
        if (dto.removeTagline) {
            account.tagline = null;
        }
        else if (dto.tagline !== undefined) {
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
        const saved = await this.accounts.save(account);
        metrics_1.accountProfileUpdateCounter.inc({ actor: 'admin', type: account.type });
        return this.sanitize(saved);
    }
    async listAccounts(query) {
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
            qb.andWhere('(account.email ILIKE :pattern OR account.fullName ILIKE :pattern OR account.companyName ILIKE :pattern)', { pattern });
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
        const stats = this.buildStats(statusCountsRaw, roleCountsRaw);
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
    async updateAccountStatus(id, status, actorId) {
        this.ensureValidStatus(status);
        const trimmed = id?.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('id_required');
        }
        const account = await this.accounts.findOne({ where: { id: trimmed } });
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        if (actorId && actorId === account.id && status !== 'ACTIVE') {
            throw new common_1.BadRequestException('cannot_suspend_self');
        }
        if (account.role === 'ADMIN' && status !== 'ACTIVE') {
            const otherAdmins = await this.accounts.count({
                where: { role: 'ADMIN', status: 'ACTIVE', id: (0, typeorm_2.Not)(account.id) },
            });
            if (otherAdmins === 0) {
                throw new common_1.BadRequestException('cannot_suspend_last_admin');
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
    async updateAccountRole(id, role, actorId) {
        this.ensureValidRole(role);
        const trimmed = id?.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('id_required');
        }
        const account = await this.accounts.findOne({ where: { id: trimmed } });
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        if (actorId && actorId === account.id && role !== 'ADMIN') {
            throw new common_1.BadRequestException('cannot_demote_self');
        }
        if (account.role === 'ADMIN' && role !== 'ADMIN') {
            const otherAdmins = await this.accounts.count({ where: { role: 'ADMIN', id: (0, typeorm_2.Not)(account.id) } });
            if (otherAdmins === 0) {
                throw new common_1.BadRequestException('cannot_remove_last_admin');
            }
        }
        if (account.role === role) {
            return this.sanitize(account);
        }
        account.role = role;
        const saved = await this.accounts.save(account);
        return this.sanitize(saved);
    }
    async sendWelcomeEmail(account) {
        try {
            const displayName = account.type === 'COMPANY'
                ? account.companyName || account.contactName || 'equipe'
                : account.fullName || account.email.split('@')[0];
            const sent = await this.mailer.sendWelcomeEmail(account.email, {
                name: displayName,
                type: account.type,
            });
            if (!sent) {
                this.logger.warn(`Welcome email skipped for account ${account.id}`);
            }
        }
        catch (err) {
            this.logger.error(`Welcome email failed for account ${account.id}: ${err?.message || err}`);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Account)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.PasswordResetToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        otp_service_1.OtpService,
        mailer_service_1.MailerService])
], AuthService);
//# sourceMappingURL=auth.service.js.map