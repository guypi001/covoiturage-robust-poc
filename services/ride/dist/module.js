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
const entities_1 = require("./entities");
const ride_controller_1 = require("./ride.controller");
const event_bus_1 = require("./event-bus");
const admin_controller_1 = require("./admin.controller");
const fleet_controller_1 = require("./fleet.controller");
const internal_guard_1 = require("./internal.guard");
const metrics_1 = require("./metrics");
const dbUrl = process.env.DATABASE_URL || 'postgres://app:app@postgres:5432/covoiturage';
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(metrics_1.MetricsMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: dbUrl,
                entities: [entities_1.Ride, entities_1.Outbox, entities_1.FleetVehicle, entities_1.VehicleSchedule],
                synchronize: true,
            }),
            typeorm_1.TypeOrmModule.forFeature([entities_1.Ride, entities_1.Outbox, entities_1.FleetVehicle, entities_1.VehicleSchedule]),
        ],
        controllers: [ride_controller_1.RideController, admin_controller_1.AdminRideController, fleet_controller_1.FleetAdminController, metrics_1.MetricsController],
        providers: [event_bus_1.EventBus, internal_guard_1.InternalGuard],
    })
], AppModule);
//# sourceMappingURL=module.js.map