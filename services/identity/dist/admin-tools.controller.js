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
exports.AdminToolsController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("./dto");
const jwt_guard_1 = require("./jwt.guard");
const admin_guard_1 = require("./admin.guard");
const admin_rides_service_1 = require("./admin-rides.service");
let AdminToolsController = class AdminToolsController {
    constructor(adminRides) {
        this.adminRides = adminRides;
    }
    async shareRides(dto, req) {
        const actorId = req?.user?.sub || undefined;
        return this.adminRides.sendRideDigest(dto, actorId);
    }
};
exports.AdminToolsController = AdminToolsController;
__decorate([
    (0, common_1.Post)('rides/share'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminSendRideDigestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminToolsController.prototype, "shareRides", null);
exports.AdminToolsController = AdminToolsController = __decorate([
    (0, common_1.Controller)('admin/tools'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [admin_rides_service_1.AdminRideService])
], AdminToolsController);
//# sourceMappingURL=admin-tools.controller.js.map