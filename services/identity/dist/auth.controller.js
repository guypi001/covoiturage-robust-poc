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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const dto_1 = require("./dto");
let AuthController = class AuthController {
    constructor(auth) {
        this.auth = auth;
    }
    registerIndividual(dto) {
        return this.auth.registerIndividual(dto);
    }
    registerCompany(dto) {
        return this.auth.registerCompany(dto);
    }
    login(dto) {
        return this.auth.login(dto);
    }
    requestGmail(dto) {
        return this.auth.requestGmailOtp(dto);
    }
    verifyGmail(dto) {
        return this.auth.verifyGmailOtp(dto);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register/individual'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegisterIndividualDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "registerIndividual", null);
__decorate([
    (0, common_1.Post)('register/company'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegisterCompanyDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "registerCompany", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('gmail/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RequestGmailOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestGmail", null);
__decorate([
    (0, common_1.Post)('gmail/verify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.VerifyGmailOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyGmail", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map