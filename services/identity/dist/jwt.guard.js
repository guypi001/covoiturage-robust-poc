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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
let JwtAuthGuard = class JwtAuthGuard {
    constructor(jwt, accounts) {
        this.jwt = jwt;
        this.accounts = accounts;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const header = request.headers['authorization'];
        if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('missing_token');
        }
        const token = header.slice('Bearer '.length).trim();
        if (!token) {
            throw new common_1.UnauthorizedException('missing_token');
        }
        try {
            const payload = await this.jwt.verifyAsync(token);
            const account = await this.accounts.findOne({ where: { id: payload.sub } });
            if (!account) {
                throw new common_1.UnauthorizedException('invalid_token');
            }
            if (account.status !== 'ACTIVE') {
                throw new common_1.ForbiddenException('account_suspended');
            }
            request.user = {
                sub: account.id,
                email: account.email,
                type: account.type,
                role: account.role,
                status: account.status,
            };
            return true;
        }
        catch (e) {
            if (e instanceof common_1.ForbiddenException || e instanceof common_1.UnauthorizedException) {
                throw e;
            }
            throw new common_1.UnauthorizedException('invalid_token');
        }
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Account)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        typeorm_2.Repository])
], JwtAuthGuard);
//# sourceMappingURL=jwt.guard.js.map