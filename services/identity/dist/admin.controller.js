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
exports.AdminAccountsController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const jwt_guard_1 = require("./jwt.guard");
const admin_guard_1 = require("./admin.guard");
const dto_1 = require("./dto");
let AdminAccountsController = class AdminAccountsController {
    constructor(auth) {
        this.auth = auth;
    }
    list(query) {
        return this.auth.listAccounts(query);
    }
    async getOne(id) {
        const trimmed = id?.trim();
        if (!trimmed) {
            throw new common_1.BadRequestException('id_required');
        }
        const account = await this.auth.getProfile(trimmed);
        if (!account) {
            throw new common_1.NotFoundException('account_not_found');
        }
        return account;
    }
    updateStatus(id, dto, req) {
        const actorId = req?.user?.sub || undefined;
        return this.auth.updateAccountStatus(id, dto.status, actorId);
    }
    updateRole(id, dto, req) {
        const actorId = req?.user?.sub || undefined;
        return this.auth.updateAccountRole(id, dto.role, actorId);
    }
    updateProfile(id, dto) {
        return this.auth.adminUpdateAccountProfile(id, dto);
    }
};
exports.AdminAccountsController = AdminAccountsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ListAccountsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminAccountsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateAccountStatusDto, Object]),
    __metadata("design:returntype", void 0)
], AdminAccountsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/role'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateAccountRoleDto, Object]),
    __metadata("design:returntype", void 0)
], AdminAccountsController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Patch)(':id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateAccountProfileDto]),
    __metadata("design:returntype", void 0)
], AdminAccountsController.prototype, "updateProfile", null);
exports.AdminAccountsController = AdminAccountsController = __decorate([
    (0, common_1.Controller)('admin/accounts'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AdminAccountsController);
//# sourceMappingURL=admin.controller.js.map