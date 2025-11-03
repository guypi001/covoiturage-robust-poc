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
exports.ProfileController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const jwt_guard_1 = require("./jwt.guard");
const dto_1 = require("./dto");
let ProfileController = class ProfileController {
    constructor(auth) {
        this.auth = auth;
    }
    getPayload(req) {
        const payload = req.user;
        if (!payload) {
            throw new common_1.UnauthorizedException('missing_token');
        }
        return payload;
    }
    async me(req) {
        const payload = this.getPayload(req);
        return this.auth.getProfile(payload.sub);
    }
    async updateIndividual(req, dto) {
        const payload = this.getPayload(req);
        if (payload.type !== 'INDIVIDUAL') {
            throw new common_1.ForbiddenException('invalid_account_type');
        }
        return this.auth.updateIndividualProfile(payload.sub, dto);
    }
    async updateCompany(req, dto) {
        const payload = this.getPayload(req);
        if (payload.type !== 'COMPANY') {
            throw new common_1.ForbiddenException('invalid_account_type');
        }
        return this.auth.updateCompanyProfile(payload.sub, dto);
    }
    async lookup(req, email) {
        this.getPayload(req);
        if (!email?.trim()) {
            throw new common_1.BadRequestException('email_required');
        }
        const account = await this.auth.lookupByEmail(email);
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        return account;
    }
    async publicProfile(req, id) {
        this.getPayload(req);
        if (!id?.trim()) {
            throw new common_1.BadRequestException('id_required');
        }
        const account = await this.auth.getPublicProfile(id);
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        return account;
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me/individual'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateIndividualProfileDto]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "updateIndividual", null);
__decorate([
    (0, common_1.Patch)('me/company'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateCompanyProfileDto]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "updateCompany", null);
__decorate([
    (0, common_1.Get)('lookup'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('email')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "lookup", null);
__decorate([
    (0, common_1.Get)(':id/public'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "publicProfile", null);
exports.ProfileController = ProfileController = __decorate([
    (0, common_1.Controller)('profiles'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], ProfileController);
//# sourceMappingURL=profile.controller.js.map