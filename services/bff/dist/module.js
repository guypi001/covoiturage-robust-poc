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
const proxy_controller_1 = require("./proxy.controller");
const event_bus_1 = require("./event-bus");
const metrics_1 = require("./metrics");
let AppModule = class AppModule {
    configure(c) { c.apply(metrics_1.MetricsMiddleware).forRoutes('*'); }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({ controllers: [proxy_controller_1.ProxyController, metrics_1.MetricsController], providers: [event_bus_1.EventBus] })
], AppModule);
//# sourceMappingURL=module.js.map