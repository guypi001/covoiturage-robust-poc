"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const auth_controller_1 = require("./auth.controller");
const profile_controller_1 = require("./profile.controller");
const health_controller_1 = require("./health.controller");
const metrics_1 = require("./metrics");
const internal_controller_1 = require("./internal.controller");
const admin_controller_1 = require("./admin.controller");
const entities_1 = require("./entities");
const auth_service_1 = require("./auth.service");
const jwt_guard_1 = require("./jwt.guard");
const otp_service_1 = require("./otp.service");
const mailer_service_1 = require("./mailer.service");
const internal_guard_1 = require("./internal.guard");
const admin_guard_1 = require("./admin.guard");
const admin_tools_controller_1 = require("./admin-tools.controller");
const admin_rides_service_1 = require("./admin-rides.service");
let AppModule = class AppModule {
    configure(c) {
        c.apply(metrics_1.MetricsMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage',
                entities: [entities_1.Account, entities_1.OtpToken, entities_1.PasswordResetToken],
                synchronize: true,
            }),
            typeorm_1.TypeOrmModule.forFeature([entities_1.Account, entities_1.OtpToken, entities_1.PasswordResetToken]),
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET || 'dev-secret',
                signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
            }),
        ],
        controllers: [
            auth_controller_1.AuthController,
            profile_controller_1.ProfileController,
            health_controller_1.HealthController,
            metrics_1.MetricsController,
            internal_controller_1.InternalController,
            admin_controller_1.AdminAccountsController,
            admin_tools_controller_1.AdminToolsController,
        ],
        providers: [auth_service_1.AuthService, jwt_guard_1.JwtAuthGuard, otp_service_1.OtpService, mailer_service_1.MailerService, internal_guard_1.InternalGuard, admin_guard_1.AdminGuard, admin_rides_service_1.AdminRideService],
    })
], AppModule);
//# sourceMappingURL=module.js.map