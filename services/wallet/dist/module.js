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
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("./entities");
const wallet_controller_1 = require("./wallet.controller");
const event_bus_1 = require("./event-bus");
const metrics_1 = require("./metrics");
const typeorm_2 = require("typeorm");
const dbUrl = process.env.DATABASE_URL || '';
let AppModule = class AppModule {
    constructor(bus, ds) {
        this.bus = bus;
        this.ds = ds;
    }
    configure(c) {
        c.apply(metrics_1.MetricsMiddleware).forRoutes('*');
    }
    async onModuleInit() {
        await this.bus.subscribe('wallet-group', 'payment.captured', async (evt) => {
            if (!evt?.holdId)
                return;
            const repo = this.ds.getRepository(entities_1.Hold);
            const h = await repo.findOne({ where: { id: evt.holdId } });
            if (!h)
                return;
            h.status = 'CAPTURED';
            await repo.save(h);
            console.log('[wallet] captured hold', h.id);
        });
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: dbUrl,
                entities: [entities_1.Wallet, entities_1.Hold, entities_1.PaymentMethod],
                synchronize: true,
            }),
            typeorm_1.TypeOrmModule.forFeature([entities_1.Wallet, entities_1.Hold, entities_1.PaymentMethod]),
        ],
        controllers: [wallet_controller_1.WalletController, metrics_1.MetricsController],
        providers: [event_bus_1.EventBus],
    }),
    __metadata("design:paramtypes", [event_bus_1.EventBus, typeorm_2.DataSource])
], AppModule);
//# sourceMappingURL=module.js.map