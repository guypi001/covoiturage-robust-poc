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
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const dotenv = __importStar(require("dotenv"));
const typeorm_1 = require("typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const entities_1 = require("../entities");
const typeorm_2 = require("typeorm");
const envPath = process.env.SEED_ENV_PATH || path.resolve(__dirname, '..', '..', '.env');
const shouldOverride = process.env.SEED_ENV_OVERRIDE !== 'false';
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: shouldOverride });
}
if (process.env.DEBUG_SEED === 'true') {
    console.log(`Loaded env from ${envPath}, DATABASE_URL=${process.env.DATABASE_URL ?? '(not set)'}`);
}
let Ride = class Ride {
};
__decorate([
    (0, typeorm_2.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ride.prototype, "id", void 0);
__decorate([
    (0, typeorm_2.Column)(),
    __metadata("design:type", String)
], Ride.prototype, "driverId", void 0);
__decorate([
    (0, typeorm_2.Column)(),
    __metadata("design:type", String)
], Ride.prototype, "originCity", void 0);
__decorate([
    (0, typeorm_2.Column)(),
    __metadata("design:type", String)
], Ride.prototype, "destinationCity", void 0);
__decorate([
    (0, typeorm_2.Column)(),
    __metadata("design:type", String)
], Ride.prototype, "departureAt", void 0);
__decorate([
    (0, typeorm_2.Column)('int'),
    __metadata("design:type", Number)
], Ride.prototype, "seatsTotal", void 0);
__decorate([
    (0, typeorm_2.Column)('int'),
    __metadata("design:type", Number)
], Ride.prototype, "seatsAvailable", void 0);
__decorate([
    (0, typeorm_2.Column)('int'),
    __metadata("design:type", Number)
], Ride.prototype, "pricePerSeat", void 0);
__decorate([
    (0, typeorm_2.Index)(),
    (0, typeorm_2.Column)({ default: 'PUBLISHED' }),
    __metadata("design:type", String)
], Ride.prototype, "status", void 0);
__decorate([
    (0, typeorm_2.CreateDateColumn)(),
    __metadata("design:type", Date)
], Ride.prototype, "createdAt", void 0);
Ride = __decorate([
    (0, typeorm_2.Entity)('rides')
], Ride);
const DEFAULT_DB_URL = 'postgres://app:app@postgres:5432/covoiturage';
const DEFAULT_PASSWORD = 'Motdepasse123!';
const ACCOUNT_SEEDS = [
    {
        email: 'driver.antoine@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Antoine Martin',
        tagline: 'Paris <-> Lyon matinaux',
        comfortPreferences: ['WiFi', 'Snacks', 'AC'],
        homePreferences: {
            favoriteRoutes: [
                { from: 'Paris', to: 'Lyon' },
                { from: 'Paris', to: 'Lille' },
            ],
            quickActions: ['create-ride', 'view-earnings'],
            theme: 'sunset',
            heroMessage: 'Pret pour un nouveau trajet ?',
        },
        isDriver: true,
    },
    {
        email: 'driver.louise@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Louise Bernard',
        tagline: 'Specialiste de l Ouest',
        comfortPreferences: ['Quiet', 'USB charging'],
        homePreferences: {
            favoriteRoutes: [
                { from: 'Nantes', to: 'Rennes' },
                { from: 'Bordeaux', to: 'La Rochelle' },
            ],
            quickActions: ['create-ride', 'manage-fleet'],
            theme: 'default',
        },
        isDriver: true,
    },
    {
        email: 'driver.hugo@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Hugo Robert',
        tagline: 'Sud-Est express',
        comfortPreferences: ['AC'],
        homePreferences: {
            favoriteRoutes: [
                { from: 'Marseille', to: 'Nice' },
                { from: 'Nice', to: 'Aix-en-Provence' },
            ],
            quickActions: ['create-ride'],
            theme: 'night',
            showTips: true,
        },
        isDriver: true,
    },
    {
        email: 'driver.elena@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Elena Garcia',
        tagline: 'Traversees atlantiques',
        comfortPreferences: ['WiFi', 'AC'],
        homePreferences: {
            favoriteRoutes: [
                { from: 'Bordeaux', to: 'Toulouse' },
                { from: 'Bordeaux', to: 'Bayonne' },
            ],
            quickActions: ['create-ride', 'view-earnings'],
        },
        isDriver: true,
    },
    {
        email: 'driver.camille@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Camille Lefevre',
        tagline: 'Trajets quotidiens pour Lyon',
        comfortPreferences: ['Quiet', 'Snacks'],
        homePreferences: {
            favoriteRoutes: [
                { from: 'Lyon', to: 'Grenoble' },
                { from: 'Lyon', to: 'Saint-Etienne' },
            ],
            quickActions: ['create-ride', 'view-earnings'],
            theme: 'default',
        },
        isDriver: true,
    },
    {
        email: 'company.metrotravel@demo.local',
        type: 'COMPANY',
        companyName: 'Metro Travel',
        registrationNumber: 'MT-2024-001',
        contactName: 'Paul Laurent',
        contactPhone: '+33100000001',
        tagline: 'Mini-bus confort pour les trajets inter-urbains',
        homePreferences: {
            favoriteRoutes: [
                { from: 'Paris', to: 'Chartres' },
                { from: 'Paris', to: 'Rouen' },
            ],
            quickActions: ['manage-fleet', 'create-ride'],
            theme: 'sunset',
        },
        isDriver: true,
    },
    {
        email: 'user.julie@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Julie Petit',
        homePreferences: {
            favoriteRoutes: [
                { from: 'Paris', to: 'Lyon' },
                { from: 'Paris', to: 'Reims' },
            ],
            quickActions: ['find-ride', 'favorite-routes'],
            theme: 'default',
            showTips: true,
        },
    },
    {
        email: 'user.marc@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Marc Dubois',
        homePreferences: {
            favoriteRoutes: [
                { from: 'Marseille', to: 'Nice' },
                { from: 'Marseille', to: 'Toulon' },
            ],
            quickActions: ['find-ride'],
            theme: 'night',
        },
    },
    {
        email: 'user.sarah@demo.local',
        type: 'INDIVIDUAL',
        fullName: 'Sarah Colin',
        homePreferences: {
            favoriteRoutes: [
                { from: 'Bordeaux', to: 'La Rochelle' },
                { from: 'Bordeaux', to: 'Arcachon' },
            ],
            quickActions: ['find-ride', 'favorite-routes'],
            theme: 'sunset',
        },
    },
    {
        email: 'company.fastwheel@demo.local',
        type: 'COMPANY',
        companyName: 'Fast Wheel SAS',
        registrationNumber: 'FW-2023-992',
        contactName: 'Nina Roger',
        contactPhone: '+33200000044',
        tagline: 'Solutions de navettes quotidiennes',
        homePreferences: {
            quickActions: ['manage-fleet', 'create-ride'],
            heroMessage: 'Planifiez vos prochains trajets collectifs',
        },
    },
];
const ROUTES = [
    { origin: 'Paris', destination: 'Lyon', basePrice: 36, baseSeats: 4 },
    { origin: 'Paris', destination: 'Lille', basePrice: 22, baseSeats: 4 },
    { origin: 'Lyon', destination: 'Grenoble', basePrice: 18, baseSeats: 3 },
    { origin: 'Marseille', destination: 'Nice', basePrice: 21, baseSeats: 4 },
    { origin: 'Bordeaux', destination: 'Toulouse', basePrice: 24, baseSeats: 5 },
    { origin: 'Nantes', destination: 'Rennes', basePrice: 17, baseSeats: 3 },
    { origin: 'Strasbourg', destination: 'Metz', basePrice: 23, baseSeats: 4 },
    { origin: 'Lille', destination: 'Bruxelles', basePrice: 26, baseSeats: 4 },
];
const DEPARTURE_SLOTS = [
    { hour: 6, minute: 45 },
    { hour: 12, minute: 30 },
    { hour: 18, minute: 15 },
];
let dataSource;
function buildDataSource(url) {
    return new typeorm_1.DataSource({
        type: 'postgres',
        url,
        entities: [entities_1.Account, Ride],
        synchronize: false,
    });
}
function describeUrl(url) {
    try {
        const parsed = new URL(url);
        const user = parsed.username ? `${parsed.username}@` : '';
        const db = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
        return `${parsed.protocol}//${user}${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${db}`;
    }
    catch {
        return url;
    }
}
function resolveDatabaseUrls() {
    const primary = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DB_URL;
    const urls = [primary];
    const fallbackEnabled = process.env.SEED_LOCALHOST_FALLBACK !== 'false';
    if (fallbackEnabled) {
        try {
            const parsed = new URL(primary);
            if (parsed.hostname === 'postgres') {
                const fallback = new URL(primary);
                fallback.hostname = process.env.SEED_LOCALHOST_HOST || '127.0.0.1';
                if (process.env.SEED_LOCALHOST_PORT) {
                    fallback.port = process.env.SEED_LOCALHOST_PORT;
                }
                else if (!fallback.port) {
                    fallback.port = '5432';
                }
                fallback.host = fallback.port ? `${fallback.hostname}:${fallback.port}` : fallback.hostname;
                urls.push(fallback.toString());
            }
        }
        catch (err) {
            if (process.env.DEBUG_SEED === 'true') {
                console.warn(`Could not parse database url "${primary}" for fallback:`, err);
            }
        }
    }
    return Array.from(new Set(urls));
}
async function ensureAccounts() {
    const repo = dataSource.getRepository(entities_1.Account);
    const password = process.env.SEED_ACCOUNT_PASSWORD || DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);
    const drivers = [];
    for (const seed of ACCOUNT_SEEDS) {
        const existing = await repo.findOne({ where: { email: seed.email } });
        const baseAccount = existing ?? repo.create({ email: seed.email });
        baseAccount.type = seed.type;
        baseAccount.passwordHash = existing?.passwordHash ?? passwordHash;
        baseAccount.fullName = seed.fullName ?? null;
        baseAccount.companyName = seed.companyName ?? null;
        baseAccount.registrationNumber = seed.registrationNumber ?? null;
        baseAccount.contactName = seed.contactName ?? null;
        baseAccount.contactPhone = seed.contactPhone ?? null;
        baseAccount.comfortPreferences = seed.comfortPreferences ?? null;
        baseAccount.tagline = seed.tagline ?? null;
        baseAccount.role = baseAccount.role ?? 'USER';
        baseAccount.status = baseAccount.status ?? 'ACTIVE';
        baseAccount.homePreferences = seed.homePreferences ?? null;
        if (!baseAccount.lastLoginAt) {
            baseAccount.lastLoginAt = new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 120));
        }
        if (!baseAccount.loginCount) {
            baseAccount.loginCount = Math.floor(Math.random() * 80);
        }
        const saved = await repo.save(baseAccount);
        if (seed.isDriver) {
            drivers.push({ account: saved, seed });
        }
    }
    return drivers;
}
function computeStartDate() {
    const currentYear = new Date().getUTCFullYear();
    const targetYear = Math.min(currentYear, 2024);
    return new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
}
function computeEndDate() {
    return new Date(Date.UTC(2027, 11, 31, 0, 0, 0));
}
function makeDeparture(date, slot) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), slot.hour, slot.minute)).toISOString();
}
function pseudoRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
async function generateRides(drivers) {
    if (!drivers.length) {
        throw new Error('No driver accounts available to generate rides.');
    }
    const repo = dataSource.getRepository(Ride);
    const start = computeStartDate();
    const end = computeEndDate();
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let inserted = 0;
    let skipped = 0;
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
        const current = new Date(start.getTime());
        current.setUTCDate(start.getUTCDate() + dayIndex);
        for (let slotIndex = 0; slotIndex < DEPARTURE_SLOTS.length; slotIndex += 1) {
            const globalIndex = dayIndex * DEPARTURE_SLOTS.length + slotIndex;
            const route = ROUTES[globalIndex % ROUTES.length];
            const driver = drivers[globalIndex % drivers.length];
            const departureAt = makeDeparture(current, DEPARTURE_SLOTS[slotIndex]);
            const randomFactor = pseudoRandom(globalIndex + 1);
            const seatsTotal = route.baseSeats + Math.max(0, Math.round(randomFactor * 3));
            const booked = Math.min(seatsTotal - 1, Math.round(randomFactor * seatsTotal));
            const seatsAvailable = Math.max(1, seatsTotal - booked);
            const pricePerSeat = route.basePrice + Math.round(randomFactor * 10);
            const existing = await repo.findOne({
                where: {
                    driverId: driver.account.id,
                    originCity: route.origin,
                    destinationCity: route.destination,
                    departureAt,
                },
            });
            if (existing) {
                skipped += 1;
                continue;
            }
            const ride = repo.create({
                driverId: driver.account.id,
                originCity: route.origin,
                destinationCity: route.destination,
                departureAt,
                seatsTotal,
                seatsAvailable,
                pricePerSeat,
                status: 'PUBLISHED',
            });
            await repo.save(ride);
            inserted += 1;
        }
        if (dayIndex % 30 === 0) {
            console.log(`Progress ${dayIndex + 1}/${totalDays} days processed (${inserted} rides created, ${skipped} skipped).`);
        }
    }
    console.log(`Rides generation complete: ${inserted} new rides, ${skipped} already present.`);
}
async function main() {
    console.log('Starting bulk generation for demo data...');
    const candidates = resolveDatabaseUrls();
    let lastError;
    for (const candidate of candidates) {
        console.log(`Connecting to database: ${describeUrl(candidate)}`);
        const ds = buildDataSource(candidate);
        try {
            await ds.initialize();
            dataSource = ds;
            if (candidate !== candidates[0]) {
                console.log(`Connected using fallback url ${describeUrl(candidate)}.`);
            }
            break;
        }
        catch (error) {
            lastError = error;
            console.warn(`Connection attempt failed for ${describeUrl(candidate)}: ${error?.message ?? error}`);
            await ds.destroy().catch(() => undefined);
        }
    }
    if (!dataSource) {
        throw lastError ?? new Error('Unable to establish database connection');
    }
    try {
        const drivers = await ensureAccounts();
        console.log(`Accounts ready. ${drivers.length} driver profiles will be used for rides.`);
        await generateRides(drivers);
    }
    finally {
        await dataSource?.destroy();
    }
    console.log('Bulk generation finished successfully.');
}
main().catch((err) => {
    console.error('Bulk generation failed:', err);
    process.exitCode = 1;
});
//# sourceMappingURL=bulk-generate.js.map