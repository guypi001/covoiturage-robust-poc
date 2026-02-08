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
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const core_1 = require("@nestjs/core");
const module_1 = require("./module");
const common_1 = require("@nestjs/common");
const client = __importStar(require("prom-client"));
function setupMetrics(app) {
    const registry = new client.Registry();
    client.collectDefaultMetrics({ register: registry });
    const express = app.getHttpAdapter().getInstance();
    express.get('/metrics', async (_req, res) => {
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
    });
    express.get('/health', (_req, res) => res.json({ ok: true }));
}
function parseCorsOrigins() {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw)
        return null;
    return raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}
function applySecurityHeaders(app) {
    const express = app.getHttpAdapter().getInstance();
    express.disable('x-powered-by');
    express.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        next();
    });
}
function applyRateLimit(app) {
    const express = app.getHttpAdapter().getInstance();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
    const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 240);
    const hits = new Map();
    express.use((req, res, next) => {
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
        const now = Date.now();
        const state = hits.get(ip);
        if (!state || state.resetAt <= now) {
            hits.set(ip, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }
        if (state.count >= maxRequests) {
            res.status(429).json({ error: 'rate_limited' });
            return;
        }
        state.count += 1;
        next();
    });
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    const allowedOrigins = parseCorsOrigins();
    const corsOptions = {
        origin: allowedOrigins ?? true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
    app.enableCors(corsOptions);
    applySecurityHeaders(app);
    applyRateLimit(app);
    setupMetrics(app);
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
    console.log('bff listening on', port);
}
bootstrap();
//# sourceMappingURL=main.js.map