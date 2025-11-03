"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalGuard = void 0;
const common_1 = require("@nestjs/common");
let InternalGuard = class InternalGuard {
    constructor() {
        this.secret = process.env.INTERNAL_API_KEY;
    }
    canActivate(context) {
        if (!this.secret) {
            throw new common_1.UnauthorizedException('internal_api_disabled');
        }
        const request = context.switchToHttp().getRequest();
        const tokenHeader = request.headers['x-internal-api-key'] ?? request.headers['x-internal-secret'];
        const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
        if (token && token === this.secret) {
            return true;
        }
        throw new common_1.UnauthorizedException('invalid_internal_api_key');
    }
};
exports.InternalGuard = InternalGuard;
exports.InternalGuard = InternalGuard = __decorate([
    (0, common_1.Injectable)()
], InternalGuard);
//# sourceMappingURL=internal.guard.js.map