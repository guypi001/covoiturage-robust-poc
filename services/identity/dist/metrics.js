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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = exports.MetricsMiddleware = exports.adminRideDigestCounter = exports.otpValidationCounter = exports.otpRequestCounter = exports.accountProfileUpdateCounter = exports.accountStatusGauge = exports.accountTypeGauge = exports.accountLoginCounter = exports.accountCreatedCounter = void 0;
const common_1 = require("@nestjs/common");
const client = __importStar(require("prom-client"));
const registry = client.register;
client.collectDefaultMetrics({ register: registry });
exports.accountCreatedCounter = new client.Counter({
    name: 'identity_account_created_total',
    help: 'Nombre de comptes créés par type',
    labelNames: ['type'],
    registers: [registry],
});
exports.accountLoginCounter = new client.Counter({
    name: 'identity_account_login_total',
    help: 'Nombre de tentatives de connexion réussies',
    labelNames: ['type'],
    registers: [registry],
});
exports.accountTypeGauge = new client.Gauge({
    name: 'identity_accounts_by_type',
    help: 'Nombre total de comptes par type',
    labelNames: ['type'],
    registers: [registry],
});
exports.accountStatusGauge = new client.Gauge({
    name: 'identity_accounts_by_status',
    help: 'Nombre total de comptes par statut',
    labelNames: ['status'],
    registers: [registry],
});
exports.accountProfileUpdateCounter = new client.Counter({
    name: 'identity_profile_update_total',
    help: 'Nombre de personnalisations de profil',
    labelNames: ['actor', 'type'],
    registers: [registry],
});
exports.otpRequestCounter = new client.Counter({
    name: 'identity_otp_request_total',
    help: 'Demandes OTP par canal',
    labelNames: ['channel'],
    registers: [registry],
});
exports.otpValidationCounter = new client.Counter({
    name: 'identity_otp_validation_total',
    help: 'Résultat des validations OTP',
    labelNames: ['result'],
    registers: [registry],
});
exports.adminRideDigestCounter = new client.Counter({
    name: 'identity_admin_ride_digest_total',
    help: 'Diffusions de trajets par les administrateurs',
    labelNames: ['result'],
    registers: [registry],
});
let MetricsMiddleware = class MetricsMiddleware {
    constructor() {
        this.histogram = new client.Histogram({
            name: 'http_server_duration_seconds',
            help: 'HTTP request duration',
            labelNames: ['method', 'path', 'status'],
            buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
            registers: [registry],
        });
    }
    use(req, res, next) {
        const end = this.histogram.startTimer({ method: req.method, path: req.path });
        res.on('finish', () => end({ status: String(res.statusCode) }));
        next();
    }
};
exports.MetricsMiddleware = MetricsMiddleware;
exports.MetricsMiddleware = MetricsMiddleware = __decorate([
    (0, common_1.Injectable)()
], MetricsMiddleware);
let MetricsController = class MetricsController {
    async metrics(res) {
        res.setHeader('Content-Type', registry.contentType);
        res.send(await registry.metrics());
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)('/metrics'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "metrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)()
], MetricsController);
//# sourceMappingURL=metrics.js.map