"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetToken = exports.OtpToken = exports.Account = void 0;
const typeorm_1 = require("typeorm");
let Account = class Account {
};
exports.Account = Account;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Account.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Account.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_hash', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Account.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Account.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'company_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "companyName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'registration_number', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "registrationNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contact_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "contactName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "contactPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'comfort_preferences', type: 'text', array: true, nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "comfortPreferences", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tagline', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "tagline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'USER' }),
    __metadata("design:type", String)
], Account.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'ACTIVE' }),
    __metadata("design:type", String)
], Account.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_login_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'login_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Account.prototype, "loginCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'profile_photo_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "profilePhotoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'home_preferences', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Account.prototype, "homePreferences", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Account.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Account.prototype, "updatedAt", void 0);
exports.Account = Account = __decorate([
    (0, typeorm_1.Entity)('accounts')
], Account);
let OtpToken = class OtpToken {
};
exports.OtpToken = OtpToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OtpToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OtpToken.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'code_hash' }),
    __metadata("design:type", String)
], OtpToken.prototype, "codeHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OtpToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], OtpToken.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], OtpToken.prototype, "createdAt", void 0);
exports.OtpToken = OtpToken = __decorate([
    (0, typeorm_1.Entity)('otp_tokens')
], OtpToken);
let PasswordResetToken = class PasswordResetToken {
};
exports.PasswordResetToken = PasswordResetToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'account_id', type: 'uuid' }),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "accountId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'secret_hash', type: 'text' }),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "secretHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PasswordResetToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'used_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], PasswordResetToken.prototype, "usedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], PasswordResetToken.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PasswordResetToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PasswordResetToken.prototype, "updatedAt", void 0);
exports.PasswordResetToken = PasswordResetToken = __decorate([
    (0, typeorm_1.Entity)('password_reset_tokens')
], PasswordResetToken);
//# sourceMappingURL=entities.js.map