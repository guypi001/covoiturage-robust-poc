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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
let WalletController = class WalletController {
    constructor(wallets, holds, paymentMethods) {
        this.wallets = wallets;
        this.holds = holds;
        this.paymentMethods = paymentMethods;
    }
    async createWallet(dto) {
        const existing = await this.wallets.findOne({ where: { ownerId: dto.ownerId } });
        if (existing)
            return existing;
        if (!dto.ownerId)
            throw new common_1.BadRequestException('owner_required');
        return await this.wallets.save(this.wallets.create({ ownerId: dto.ownerId }));
    }
    async getWallet(ownerId) {
        const wallet = await this.wallets.findOne({ where: { ownerId } });
        return wallet || { error: 'not_found' };
    }
    async createHold(dto) {
        if (!dto.ownerId || !dto.referenceId || !dto.amount)
            throw new common_1.BadRequestException('missing_fields');
        let wallet = await this.wallets.findOne({ where: { ownerId: dto.ownerId } });
        if (!wallet)
            wallet = await this.wallets.save(this.wallets.create({ ownerId: dto.ownerId }));
        const hold = this.holds.create({
            ownerId: dto.ownerId,
            referenceId: dto.referenceId,
            amount: dto.amount,
            status: 'HELD',
        });
        return await this.holds.save(hold);
    }
    async getHold(id) {
        const hold = await this.holds.findOne({ where: { id } });
        return hold || { error: 'not_found' };
    }
    async listPaymentMethods(ownerId) {
        if (!ownerId)
            throw new common_1.BadRequestException('owner_required');
        const methods = await this.paymentMethods.find({
            where: { ownerId },
            order: { createdAt: 'DESC' },
        });
        return methods;
    }
    async addPaymentMethod(body) {
        if (!body?.ownerId)
            throw new common_1.BadRequestException('owner_required');
        if (!body?.type)
            throw new common_1.BadRequestException('type_required');
        if (body.type === 'CARD' && !body.last4)
            throw new common_1.BadRequestException('card_last4_required');
        if (body.type === 'MOBILE_MONEY' && !body.phoneNumber) {
            throw new common_1.BadRequestException('phone_required');
        }
        const method = this.paymentMethods.create({
            ownerId: body.ownerId,
            type: body.type,
            label: body.label?.trim() || null,
            provider: body.provider?.trim() || null,
            last4: body.last4?.slice(-4) ?? null,
            expiresAt: body.expiresAt?.trim() || null,
            phoneNumber: body.phoneNumber?.trim() || null,
        });
        return await this.paymentMethods.save(method);
    }
    async removePaymentMethod(id, ownerId) {
        if (!ownerId)
            throw new common_1.BadRequestException('owner_required');
        const method = await this.paymentMethods.findOne({ where: { id, ownerId } });
        if (!method) {
            return { ok: true };
        }
        await this.paymentMethods.delete(method.id);
        return { ok: true };
    }
};
exports.WalletController = WalletController;
__decorate([
    (0, common_1.Post)('wallets'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "createWallet", null);
__decorate([
    (0, common_1.Get)('wallets/:ownerId'),
    __param(0, (0, common_1.Param)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "getWallet", null);
__decorate([
    (0, common_1.Post)('holds'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "createHold", null);
__decorate([
    (0, common_1.Get)('holds/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "getHold", null);
__decorate([
    (0, common_1.Get)('payment-methods'),
    __param(0, (0, common_1.Query)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "listPaymentMethods", null);
__decorate([
    (0, common_1.Post)('payment-methods'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "addPaymentMethod", null);
__decorate([
    (0, common_1.Delete)('payment-methods/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "removePaymentMethod", null);
exports.WalletController = WalletController = __decorate([
    (0, common_1.Controller)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Wallet)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Hold)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.PaymentMethod)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], WalletController);
//# sourceMappingURL=wallet.controller.js.map