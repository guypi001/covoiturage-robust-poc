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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyController = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const metrics_1 = require("./metrics");
const rideHosts = [
    process.env.RIDE_URL,
    process.env.RIDE_INTERNAL_URL,
    'http://ride:3002',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
].filter((value) => Boolean(value));
const RIDE = rideHosts[0] ?? 'http://ride:3002';
const SEARCH = process.env.SEARCH_URL || 'http://search:3003';
const BOOKING = process.env.BOOKING_URL || 'http://booking:3004';
const PAYMENT = process.env.PAYMENT_URL || 'http://payment:3005';
const IDENTITY = process.env.IDENTITY_URL || 'http://identity:3000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'super-internal-key';
let ProxyController = class ProxyController {
    async createRide(body, req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        const driverLabel = account.fullName || account.companyName || account.email || 'Compte KariGo';
        const payload = {
            ...body,
            driverId: account.id,
            driverLabel,
            seatsTotal: body?.seatsTotal,
            seatsAvailable: body?.seatsAvailable !== undefined ? body.seatsAvailable : body?.seatsTotal,
        };
        return this.forward(() => axios_1.default.post(`${RIDE}/rides`, payload), 'ride');
    }
    async search(q) {
        return this.forward(() => axios_1.default.get(`${SEARCH}/search`, { params: q }), 'search');
    }
    async booking(body) {
        return this.forward(() => axios_1.default.post(`${BOOKING}/bookings`, body), 'booking');
    }
    async capture(body) {
        return this.forward(() => axios_1.default.post(`${PAYMENT}/mock-capture`, body), 'payment');
    }
    async myBookings(req, query) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        const limit = Math.min(Math.max(Number(query?.limit ?? 50) || 50, 1), 200);
        const params = {
            passengerId: account.id,
            limit,
            offset: Math.max(Number(query?.offset ?? 0) || 0, 0),
        };
        if (query?.status)
            params.status = query.status;
        if (query?.rideId)
            params.rideId = query.rideId;
        const bookingPayload = await this.forward(() => axios_1.default.get(`${BOOKING}/admin/bookings`, {
            params,
            headers: this.internalHeaders(),
        }), 'booking');
        const items = Array.isArray(bookingPayload?.data) ? bookingPayload.data : [];
        const uniqueRideIds = Array.from(new Set(items.map((booking) => booking?.rideId).filter((rideId) => Boolean(rideId))));
        const rideMap = new Map();
        await Promise.all(uniqueRideIds.map(async (rideId) => {
            try {
                const ride = await axios_1.default.get(`${RIDE}/rides/${rideId}`);
                rideMap.set(rideId, ride.data);
            }
            catch (err) {
                rideMap.set(rideId, null);
            }
        }));
        return {
            ...bookingPayload,
            data: items.map((booking) => ({
                ...booking,
                ride: rideMap.get(booking?.rideId ?? '') ?? null,
            })),
        };
    }
    async registerIndividual(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/register/individual`, body), 'identity');
    }
    async registerCompany(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/register/company`, body), 'identity');
    }
    async login(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/login`, body), 'identity');
    }
    async gmailRequest(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/gmail/request`, body), 'identity');
    }
    async gmailVerify(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/gmail/verify`, body), 'identity');
    }
    async getProfile(req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.get(`${IDENTITY}/profiles/me`, {
            headers,
        }), 'identity');
    }
    async updateIndividual(body, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.patch(`${IDENTITY}/profiles/me/individual`, body, {
            headers,
        }), 'identity');
    }
    async updateCompany(body, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.patch(`${IDENTITY}/profiles/me/company`, body, {
            headers,
        }), 'identity');
    }
    async myFleet(req, query) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.get(`${RIDE}/admin/companies/${account.id}/vehicles`, {
            params: query,
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async createFleetVehicle(req, body) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.post(`${RIDE}/admin/companies/${account.id}/vehicles`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async updateFleetVehicle(req, vehicleId, body) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.patch(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async archiveFleetVehicle(req, vehicleId) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.delete(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}`, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async listFleetSchedules(req, vehicleId, query) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.get(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}/schedules`, {
            params: query,
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async createFleetSchedule(req, vehicleId, body) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.post(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}/schedules`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async updateFleetSchedule(req, vehicleId, scheduleId, body) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.patch(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}/schedules/${scheduleId}`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async cancelFleetSchedule(req, vehicleId, scheduleId) {
        const account = await this.ensureCompanyAccount(req);
        return this.forward(() => axios_1.default.delete(`${RIDE}/admin/companies/${account.id}/vehicles/${vehicleId}/schedules/${scheduleId}`, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminListFleet(req, companyId, query) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.get(`${RIDE}/admin/companies/${companyId}/vehicles`, {
            params: query,
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminCreateFleetVehicle(req, companyId, body) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.post(`${RIDE}/admin/companies/${companyId}/vehicles`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminUpdateFleetVehicle(req, companyId, vehicleId, body) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.patch(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminArchiveFleetVehicle(req, companyId, vehicleId) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.delete(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}`, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminListFleetSchedules(req, companyId, vehicleId, query) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.get(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}/schedules`, {
            params: query,
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminCreateFleetSchedule(req, companyId, vehicleId, body) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.post(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}/schedules`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminUpdateFleetSchedule(req, companyId, vehicleId, scheduleId, body) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.patch(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}/schedules/${scheduleId}`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminCancelFleetSchedule(req, companyId, vehicleId, scheduleId) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.delete(`${RIDE}/admin/companies/${companyId}/vehicles/${vehicleId}/schedules/${scheduleId}`, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async lookupProfile(email, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.get(`${IDENTITY}/profiles/lookup`, {
            params: { email },
            headers,
        }), 'identity');
    }
    async publicProfile(id, req) {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(id ?? '')) {
            throw new common_1.NotFoundException('account_not_found');
        }
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.get(`${IDENTITY}/profiles/${id}/public`, {
            headers,
        }), 'identity');
    }
    async adminListAccounts(query, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.get(`${IDENTITY}/admin/accounts`, {
            params: query,
            headers,
        }), 'identity');
    }
    async adminGetAccount(id, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.get(`${IDENTITY}/admin/accounts/${id}`, {
            headers,
        }), 'identity');
    }
    async adminUpdateStatus(id, body, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.patch(`${IDENTITY}/admin/accounts/${id}/status`, body, {
            headers,
        }), 'identity');
    }
    async adminUpdateRole(id, body, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.patch(`${IDENTITY}/admin/accounts/${id}/role`, body, {
            headers,
        }), 'identity');
    }
    async adminUpdateProfile(id, body, req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return this.forward(() => axios_1.default.patch(`${IDENTITY}/admin/accounts/${id}/profile`, body, {
            headers,
        }), 'identity');
    }
    async adminAccountActivity(id, req) {
        const authHeaders = this.extractAuthHeaders(req);
        await this.ensureAdminAccount(req);
        const account = await this.forward(() => axios_1.default.get(`${IDENTITY}/admin/accounts/${id}`, {
            headers: authHeaders,
        }), 'identity');
        const internalHeaders = this.internalHeaders();
        const [ridesRes, bookingsRes] = await Promise.allSettled([
            this.forward(() => axios_1.default.get(`${RIDE}/admin/rides`, {
                params: { driverId: id, limit: 100 },
                headers: internalHeaders,
            }), 'ride'),
            this.forward(() => axios_1.default.get(`${BOOKING}/admin/bookings`, {
                params: { passengerId: id, limit: 100 },
                headers: internalHeaders,
            }), 'booking'),
        ]);
        const ridesPayload = ridesRes.status === 'fulfilled'
            ? ridesRes.value
            : {
                data: [],
                total: 0,
                summary: { upcoming: 0, published: 0, seatsBooked: 0, seatsTotal: 0 },
            };
        const bookingsPayload = bookingsRes.status === 'fulfilled'
            ? bookingsRes.value
            : {
                data: [],
                total: 0,
                summary: { byStatus: {}, amountTotal: 0, seatsTotal: 0 },
            };
        const rides = Array.isArray(ridesPayload?.data) ? ridesPayload.data : [];
        const rideSummaryRaw = ridesPayload?.summary ?? {};
        const rideSummary = {
            upcoming: Number(rideSummaryRaw?.upcoming ?? 0),
            published: Number(rideSummaryRaw?.published ?? 0),
            seatsBooked: Number(rideSummaryRaw?.seatsBooked ?? 0),
            seatsTotal: Number(rideSummaryRaw?.seatsTotal ?? 0),
        };
        const rideTotal = Number(ridesPayload?.total ?? rides.length);
        const bookings = Array.isArray(bookingsPayload?.data) ? bookingsPayload.data : [];
        const bookingSummaryRaw = bookingsPayload?.summary ?? {};
        const bookingSummary = {
            byStatus: bookingSummaryRaw?.byStatus ?? {},
            amountTotal: Number(bookingSummaryRaw?.amountTotal ?? 0),
            seatsTotal: Number(bookingSummaryRaw?.seatsTotal ?? 0),
        };
        const bookingTotal = Number(bookingsPayload?.total ?? bookings.length);
        const derivedMetrics = this.computeActivityMetrics(rides, bookings);
        return {
            account,
            rides: {
                total: rideTotal,
                items: rides,
                summary: rideSummary,
            },
            bookings: {
                total: bookingTotal,
                items: bookings,
                summary: bookingSummary,
            },
            metrics: derivedMetrics,
        };
    }
    async adminListRides(req, query) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.get(`${RIDE}/admin/rides`, {
            params: query,
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminUpdateRide(id, body, req) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.patch(`${RIDE}/admin/rides/${id}`, body, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminCloseRide(id, req) {
        await this.ensureAdminAccount(req);
        return this.forward(() => axios_1.default.post(`${RIDE}/admin/rides/${id}/close`, {}, {
            headers: this.internalHeaders(),
        }), 'ride');
    }
    async adminShareRides(body, req) {
        await this.ensureAdminAccount(req);
        const headers = this.extractAuthHeaders(req);
        return this.forward(() => axios_1.default.post(`${IDENTITY}/admin/tools/rides/share`, body, {
            headers,
        }), 'identity');
    }
    async forward(call, target) {
        const end = metrics_1.upstreamDurationHistogram.startTimer({ target });
        const hosts = target === 'ride' ? rideHosts : [undefined];
        let lastError = null;
        for (const host of hosts) {
            const attemptTarget = host ?? target;
            try {
                const res = await call();
                metrics_1.upstreamRequestCounter.inc({ target: attemptTarget, outcome: 'success' });
                end();
                return res.data;
            }
            catch (err) {
                const axiosErr = axios_1.default.isAxiosError(err) ? err : null;
                if (axiosErr) {
                    lastError = axiosErr;
                }
                const status = axiosErr?.response?.status;
                const outcome = status
                    ? status >= 500
                        ? '5xx'
                        : status >= 400
                            ? '4xx'
                            : String(status)
                    : 'error';
                metrics_1.upstreamRequestCounter.inc({ target: attemptTarget, outcome });
                if (target !== 'ride') {
                    end();
                    if (axiosErr) {
                        const payload = axiosErr.response?.data ?? {
                            error: 'proxy_error',
                            message: axiosErr.message,
                            target: attemptTarget,
                        };
                        throw new common_1.HttpException(payload, axiosErr.response?.status ?? 502);
                    }
                    throw new common_1.InternalServerErrorException('proxy_failure');
                }
            }
        }
        end();
        if (lastError) {
            const payload = lastError.response?.data ?? {
                error: 'proxy_error',
                message: lastError.message,
                target: 'ride',
            };
            throw new common_1.HttpException(payload, lastError.response?.status ?? 502);
        }
        throw new common_1.InternalServerErrorException('proxy_failure');
    }
    async fetchMyAccount(req) {
        const headers = this.extractAuthHeaders(req);
        return this.forward(() => axios_1.default.get(`${IDENTITY}/profiles/me`, { headers }), 'identity');
    }
    async ensureCompanyAccount(req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id || account.type !== 'COMPANY') {
            throw new common_1.ForbiddenException('company_account_required');
        }
        return account;
    }
    async ensureAdminAccount(req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id || account.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('admin_only');
        }
        return account;
    }
    extractAuthHeaders(req) {
        const headers = {};
        if (req.headers?.authorization)
            headers['authorization'] = req.headers.authorization;
        return headers;
    }
    internalHeaders() {
        return { 'x-internal-key': INTERNAL_KEY };
    }
    computeActivityMetrics(rides, bookings) {
        const now = Date.now();
        const ridesUpcoming = rides.filter((ride) => {
            const ts = Date.parse(ride?.departureAt ?? '');
            return Number.isFinite(ts) && ts > now;
        }).length;
        const ridesPast = rides.filter((ride) => {
            const ts = Date.parse(ride?.departureAt ?? '');
            return Number.isFinite(ts) && ts <= now;
        }).length;
        const seatsPublished = rides.reduce((acc, ride) => acc + (ride?.seatsTotal ?? 0), 0);
        const seatsReserved = rides.reduce((acc, ride) => acc + ((ride?.seatsTotal ?? 0) - (ride?.seatsAvailable ?? 0)), 0);
        const bookingAmount = bookings.reduce((acc, booking) => acc + (booking?.amount ?? 0), 0);
        const bookingSeats = bookings.reduce((acc, booking) => acc + (booking?.seats ?? 0), 0);
        const bookingStatusCount = bookings.reduce((acc, booking) => {
            const status = booking?.status ?? 'UNKNOWN';
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
        }, {});
        return {
            rides: {
                upcoming: ridesUpcoming,
                past: ridesPast,
                seatsPublished,
                seatsReserved,
            },
            bookings: {
                totalSeats: bookingSeats,
                totalAmount: bookingAmount,
                byStatus: bookingStatusCount,
            },
        };
    }
};
exports.ProxyController = ProxyController;
__decorate([
    (0, common_1.Post)('rides'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "createRide", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "search", null);
__decorate([
    (0, common_1.Post)('bookings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "booking", null);
__decorate([
    (0, common_1.Post)('payments/capture'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "capture", null);
__decorate([
    (0, common_1.Get)('me/bookings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myBookings", null);
__decorate([
    (0, common_1.Post)('auth/register/individual'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "registerIndividual", null);
__decorate([
    (0, common_1.Post)('auth/register/company'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "registerCompany", null);
__decorate([
    (0, common_1.Post)('auth/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('auth/gmail/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "gmailRequest", null);
__decorate([
    (0, common_1.Post)('auth/gmail/verify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "gmailVerify", null);
__decorate([
    (0, common_1.Get)('profiles/me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('profiles/me/individual'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "updateIndividual", null);
__decorate([
    (0, common_1.Patch)('profiles/me/company'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "updateCompany", null);
__decorate([
    (0, common_1.Get)('companies/me/vehicles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myFleet", null);
__decorate([
    (0, common_1.Post)('companies/me/vehicles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "createFleetVehicle", null);
__decorate([
    (0, common_1.Patch)('companies/me/vehicles/:vehicleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "updateFleetVehicle", null);
__decorate([
    (0, common_1.Delete)('companies/me/vehicles/:vehicleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "archiveFleetVehicle", null);
__decorate([
    (0, common_1.Get)('companies/me/vehicles/:vehicleId/schedules'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "listFleetSchedules", null);
__decorate([
    (0, common_1.Post)('companies/me/vehicles/:vehicleId/schedules'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "createFleetSchedule", null);
__decorate([
    (0, common_1.Patch)('companies/me/vehicles/:vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "updateFleetSchedule", null);
__decorate([
    (0, common_1.Delete)('companies/me/vehicles/:vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('vehicleId')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "cancelFleetSchedule", null);
__decorate([
    (0, common_1.Get)('admin/companies/:companyId/vehicles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminListFleet", null);
__decorate([
    (0, common_1.Post)('admin/companies/:companyId/vehicles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminCreateFleetVehicle", null);
__decorate([
    (0, common_1.Patch)('admin/companies/:companyId/vehicles/:vehicleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateFleetVehicle", null);
__decorate([
    (0, common_1.Delete)('admin/companies/:companyId/vehicles/:vehicleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminArchiveFleetVehicle", null);
__decorate([
    (0, common_1.Get)('admin/companies/:companyId/vehicles/:vehicleId/schedules'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminListFleetSchedules", null);
__decorate([
    (0, common_1.Post)('admin/companies/:companyId/vehicles/:vehicleId/schedules'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminCreateFleetSchedule", null);
__decorate([
    (0, common_1.Patch)('admin/companies/:companyId/vehicles/:vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __param(3, (0, common_1.Param)('scheduleId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateFleetSchedule", null);
__decorate([
    (0, common_1.Delete)('admin/companies/:companyId/vehicles/:vehicleId/schedules/:scheduleId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Param)('vehicleId')),
    __param(3, (0, common_1.Param)('scheduleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminCancelFleetSchedule", null);
__decorate([
    (0, common_1.Get)('profiles/lookup'),
    __param(0, (0, common_1.Query)('email')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "lookupProfile", null);
__decorate([
    (0, common_1.Get)('profiles/:id/public'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "publicProfile", null);
__decorate([
    (0, common_1.Get)('admin/accounts'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminListAccounts", null);
__decorate([
    (0, common_1.Get)('admin/accounts/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminGetAccount", null);
__decorate([
    (0, common_1.Patch)('admin/accounts/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateStatus", null);
__decorate([
    (0, common_1.Patch)('admin/accounts/:id/role'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateRole", null);
__decorate([
    (0, common_1.Patch)('admin/accounts/:id/profile'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateProfile", null);
__decorate([
    (0, common_1.Get)('admin/accounts/:id/activity'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminAccountActivity", null);
__decorate([
    (0, common_1.Get)('admin/rides'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminListRides", null);
__decorate([
    (0, common_1.Patch)('admin/rides/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminUpdateRide", null);
__decorate([
    (0, common_1.Post)('admin/rides/:id/close'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminCloseRide", null);
__decorate([
    (0, common_1.Post)('admin/rides/share'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "adminShareRides", null);
exports.ProxyController = ProxyController = __decorate([
    (0, common_1.Controller)()
], ProxyController);
//# sourceMappingURL=proxy.controller.js.map