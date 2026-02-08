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
const receipt_1 = require("./receipt");
function normalizeRideUrl(value) {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value);
        if ((parsed.hostname === 'ride' || parsed.hostname.endsWith('.ride')) && parsed.port === '3002') {
            parsed.port = '3000';
            return parsed.toString();
        }
        return value;
    }
    catch {
        return value;
    }
}
function normalizeInternalServiceUrl(value, serviceName, legacyPort) {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value);
        if ((parsed.hostname === serviceName || parsed.hostname.endsWith(`.${serviceName}`)) &&
            parsed.port === legacyPort) {
            parsed.port = '3000';
            return parsed.toString();
        }
        return value;
    }
    catch {
        return value;
    }
}
const rideHosts = [
    normalizeRideUrl(process.env.RIDE_INTERNAL_URL),
    normalizeRideUrl(process.env.RIDE_URL),
    'http://ride:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
].filter((value) => Boolean(value));
const RIDE = rideHosts[0] ?? 'http://ride:3000';
const SEARCH = normalizeInternalServiceUrl(process.env.SEARCH_URL, 'search', '3003') || 'http://search:3000';
const BOOKING = normalizeInternalServiceUrl(process.env.BOOKING_URL, 'booking', '3004') || 'http://booking:3000';
const PAYMENT = normalizeInternalServiceUrl(process.env.PAYMENT_URL, 'payment', '3005') || 'http://payment:3000';
const WALLET = normalizeInternalServiceUrl(process.env.WALLET_URL, 'wallet', '3008') || 'http://wallet:3000';
const IDENTITY = normalizeInternalServiceUrl(process.env.IDENTITY_URL, 'identity', '3001') || 'http://identity:3000';
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
    async myRideBookings(req, rideId) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        if (!rideId?.trim()) {
            throw new common_1.NotFoundException('ride_not_found');
        }
        const rideRes = await axios_1.default.get(`${RIDE}/rides/${rideId}`, { headers: this.internalHeaders() });
        const ride = rideRes?.data;
        if (!ride?.id || ride?.driverId !== account.id) {
            throw new common_1.ForbiddenException('not_ride_owner');
        }
        return this.forward(() => axios_1.default.get(`${BOOKING}/admin/bookings`, {
            params: { rideId: rideId },
            headers: this.internalHeaders(),
        }), 'booking');
    }
    async myPaymentMethods(req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            return [];
        }
        return this.forward(() => axios_1.default.get(`${WALLET}/payment-methods`, {
            params: { ownerId: account.id },
            headers: this.internalHeaders(),
        }), 'wallet');
    }
    async addPaymentMethod(req, body) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.post(`${WALLET}/payment-methods`, {
            ...body,
            ownerId: account.id,
        }, { headers: this.internalHeaders() }), 'wallet');
    }
    async deletePaymentMethod(req, id) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.delete(`${WALLET}/payment-methods/${id}`, {
            params: { ownerId: account.id },
            headers: this.internalHeaders(),
        }), 'wallet');
    }
    async setDefaultPaymentMethod(req, id) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.post(`${WALLET}/payment-methods/${id}/default`, {}, {
            params: { ownerId: account.id },
            headers: this.internalHeaders(),
        }), 'wallet');
    }
    async getWallet(req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.get(`${WALLET}/wallets/${account.id}`, { headers: this.internalHeaders() }), 'wallet');
    }
    async getWalletTransactions(req, limit) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.get(`${WALLET}/wallets/${account.id}/transactions`, {
            params: { limit },
            headers: this.internalHeaders(),
        }), 'wallet');
    }
    async search(q) {
        return this.forward(() => axios_1.default.get(`${SEARCH}/search`, { params: q }), 'search');
    }
    async myProfile(req) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        return account;
    }
    async booking(body, req) {
        const account = await this.fetchMyAccount(req);
        const rideId = body?.rideId;
        const seatsRaw = body?.seats;
        const seats = Number(seatsRaw);
        if (!rideId || typeof rideId !== 'string') {
            throw new common_1.HttpException({ error: 'ride_id_required' }, 400);
        }
        if (!Number.isFinite(seats) || seats <= 0) {
            throw new common_1.HttpException({ error: 'invalid_seats' }, 400);
        }
        const passengerId = (account?.id && typeof account.id === 'string' && account.id.length > 0
            ? account.id
            : typeof body?.passengerId === 'string' && body.passengerId.length > 0
                ? body.passengerId
                : undefined) ?? `guest-${Date.now()}`;
        let rideSeatsAvailable;
        let rideStatus;
        try {
            const rideResp = await axios_1.default.get(`${RIDE}/rides/${rideId}`, { headers: this.internalHeaders() });
            rideSeatsAvailable = Number(rideResp.data?.seatsAvailable ?? 0);
            rideStatus = rideResp.data?.status;
            if (!Number.isFinite(rideSeatsAvailable))
                rideSeatsAvailable = 0;
        }
        catch (err) {
            throw new common_1.HttpException({ error: 'ride_not_found', detail: 'Impossible de récupérer ce trajet pour le moment.' }, common_1.HttpStatus.NOT_FOUND);
        }
        if (rideStatus && rideStatus !== 'PUBLISHED') {
            throw new common_1.HttpException({ error: 'ride_closed', detail: 'Ce trajet n’est plus disponible.' }, common_1.HttpStatus.CONFLICT);
        }
        if (!rideSeatsAvailable || rideSeatsAvailable <= 0) {
            throw new common_1.HttpException({ error: 'not_enough_seats', detail: 'Plus aucun siège n’est disponible.' }, common_1.HttpStatus.CONFLICT);
        }
        const normalizedSeats = Math.min(Math.floor(seats), rideSeatsAvailable);
        if (normalizedSeats < 1) {
            throw new common_1.HttpException({ error: 'not_enough_seats', detail: 'Plus assez de sièges pour ta demande.' }, common_1.HttpStatus.CONFLICT);
        }
        if (normalizedSeats < Math.floor(seats)) {
            throw new common_1.HttpException({
                error: 'not_enough_seats',
                detail: `Il reste uniquement ${rideSeatsAvailable} place(s).`,
            }, common_1.HttpStatus.CONFLICT);
        }
        const passengerName = typeof body?.passengerName === 'string' ? body.passengerName.trim() : undefined;
        const passengerEmail = typeof body?.passengerEmail === 'string' ? body.passengerEmail.trim() : undefined;
        const passengerPhone = typeof body?.passengerPhone === 'string' ? body.passengerPhone.trim() : undefined;
        const payload = {
            rideId,
            seats: normalizedSeats,
            passengerId,
            passengerName: passengerName || undefined,
            passengerEmail: passengerEmail || undefined,
            passengerPhone: passengerPhone || undefined,
        };
        try {
            return await this.forward(() => axios_1.default.post(`${BOOKING}/bookings`, payload), 'booking');
        }
        catch (err) {
            if (err instanceof common_1.HttpException) {
                const status = err.getStatus?.();
                if (status === common_1.HttpStatus.BAD_REQUEST) {
                    const response = err.getResponse();
                    const detail = typeof response === 'object' ? response?.detail || response?.error : undefined;
                    const lower = typeof detail === 'string' ? detail.toLowerCase() : '';
                    if (lower.includes('seat lock')) {
                        let seatsAvailable;
                        try {
                            const ride = await axios_1.default
                                .get(`${RIDE}/rides/${rideId}`, { headers: this.internalHeaders() })
                                .then((res) => res.data)
                                .catch(() => null);
                            if (ride && typeof ride.seatsAvailable === 'number')
                                seatsAvailable = ride.seatsAvailable;
                        }
                        catch {
                        }
                        throw new common_1.HttpException({
                            error: 'not_enough_seats',
                            detail: seatsAvailable !== undefined
                                ? `Il ne reste que ${seatsAvailable} place(s) disponibles`
                                : 'Plus assez de sièges disponibles',
                        }, common_1.HttpStatus.CONFLICT);
                    }
                }
            }
            throw err;
        }
    }
    async lookupBookingReference(req, code) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        const trimmed = code?.trim();
        if (!trimmed || !/^\d{8}$/.test(trimmed)) {
            throw new common_1.HttpException({ error: 'invalid_reference' }, common_1.HttpStatus.BAD_REQUEST);
        }
        const bookingRes = await axios_1.default.get(`${BOOKING}/admin/bookings/reference/${trimmed}`, {
            headers: this.internalHeaders(),
        });
        const booking = bookingRes?.data;
        if (!booking) {
            throw new common_1.NotFoundException('booking_not_found');
        }
        const ride = booking.rideId
            ? await axios_1.default
                .get(`${RIDE}/rides/${booking.rideId}`, { headers: this.internalHeaders() })
                .then((resp) => resp.data)
                .catch(() => null)
            : null;
        const isAdmin = account.role === 'ADMIN';
        const isPassenger = account.id === booking.passengerId;
        const isDriver = ride?.driverId && account.id === ride.driverId;
        if (!isAdmin && !isPassenger && !isDriver) {
            throw new common_1.ForbiddenException('booking_forbidden');
        }
        const ids = [booking.passengerId, ride?.driverId].filter(Boolean).join(',');
        let passengers = [];
        if (ids) {
            try {
                const res = await axios_1.default.get(`${IDENTITY}/internal/accounts`, {
                    params: { ids },
                    headers: this.internalHeaders(),
                });
                passengers = Array.isArray(res.data?.data) ? res.data.data : [];
            }
            catch {
                passengers = [];
            }
        }
        const passengerProfile = passengers.find((item) => item.id === booking.passengerId);
        const driverProfile = passengers.find((item) => item.id === ride?.driverId);
        const passengerName = booking.passengerName ||
            passengerProfile?.fullName ||
            passengerProfile?.companyName ||
            passengerProfile?.email ||
            'Passager';
        const driverName = driverProfile?.fullName || driverProfile?.companyName || driverProfile?.email || 'Conducteur';
        return {
            referenceCode: booking.referenceCode ?? trimmed,
            status: booking.status,
            seats: booking.seats,
            amount: booking.amount,
            passenger: {
                name: passengerName,
                email: isAdmin ? booking.passengerEmail || passengerProfile?.email : undefined,
                phone: isAdmin ? booking.passengerPhone : undefined,
            },
            driver: {
                name: driverName,
            },
            ride: {
                originCity: ride?.originCity ?? null,
                destinationCity: ride?.destinationCity ?? null,
                departureAt: ride?.departureAt ?? null,
                status: ride?.status ?? null,
            },
        };
    }
    async capture(body, req) {
        const headers = {};
        if (body.idempotencyKey)
            headers['Idempotency-Key'] = body.idempotencyKey;
        const account = await this.fetchMyAccount(req).catch(() => null);
        const payload = {
            ...body,
            payerId: account?.id,
        };
        return this.forward(() => axios_1.default.post(`${PAYMENT}/payments/capture`, payload, { headers }), 'payment');
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
        if (uniqueRideIds.length) {
            try {
                const payload = await this.forward(() => axios_1.default.get(`${RIDE}/admin/rides/batch`, {
                    params: { ids: uniqueRideIds.join(',') },
                    headers: this.internalHeaders(),
                }), 'ride');
                const rides = Array.isArray(payload?.data) ? payload.data : [];
                rides.forEach((ride) => {
                    if (ride?.id)
                        rideMap.set(ride.id, ride);
                });
            }
            catch {
                uniqueRideIds.forEach((rideId) => rideMap.set(rideId, null));
            }
        }
        return {
            ...bookingPayload,
            data: items.map((booking) => ({
                ...booking,
                ride: rideMap.get(booking?.rideId ?? '') ?? null,
            })),
        };
    }
    async cancelBooking(req, id) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        return this.forward(() => axios_1.default.post(`${BOOKING}/bookings/${id}/cancel`, { passengerId: account.id }, { headers: this.internalHeaders() }), 'booking');
    }
    async bookingReceipt(req, id, res) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        let booking;
        try {
            const bookingRes = await axios_1.default.get(`${BOOKING}/admin/bookings/${id}`, {
                headers: this.internalHeaders(),
            });
            booking = bookingRes.data;
        }
        catch (err) {
            const status = err?.response?.status;
            if (status === 404) {
                throw new common_1.NotFoundException('booking_not_found');
            }
            throw new common_1.InternalServerErrorException('booking_receipt_unavailable');
        }
        if (!booking || booking.passengerId !== account.id) {
            throw new common_1.ForbiddenException('booking_forbidden');
        }
        let ride = null;
        if (booking?.rideId) {
            try {
                ride = await axios_1.default
                    .get(`${RIDE}/rides/${booking.rideId}`, {
                    headers: this.internalHeaders(),
                })
                    .then((response) => response.data);
            }
            catch {
                ride = null;
            }
        }
        const paymentMethodLabel = booking.paymentMethod
            ? booking.paymentMethod === 'CASH'
                ? 'Especes'
                : booking.paymentProvider
                    ? `${booking.paymentMethod} (${booking.paymentProvider})`
                    : booking.paymentMethod
            : 'Paiement';
        const passengerName = booking?.passengerName ||
            account.fullName ||
            account.companyName ||
            account.email ||
            'Client KariGo';
        const passengerEmail = booking?.passengerEmail || account.email;
        const pdfBuffer = (0, receipt_1.buildReceiptPdfBuffer)({
            bookingId: booking.id,
            bookingReference: booking.referenceCode ?? undefined,
            passengerName,
            passengerEmail,
            originCity: ride?.originCity ?? undefined,
            destinationCity: ride?.destinationCity ?? undefined,
            departureAt: ride?.departureAt ?? undefined,
            seats: booking.seats,
            amount: booking.amount,
            paymentMethod: paymentMethodLabel,
            issuedAt: new Date().toISOString(),
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="recu-${booking.id}.pdf"`);
        res.status(common_1.HttpStatus.OK).send(pdfBuffer);
    }
    async myRides(req, query) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('account_not_found');
        }
        const limit = Math.min(Math.max(Number(query?.limit ?? 50) || 50, 1), 200);
        const params = {
            driverId: account.id,
            limit,
            offset: Math.max(Number(query?.offset ?? 0) || 0, 0),
            sort: query?.sort ?? 'departure_desc',
        };
        if (query?.status)
            params.status = query.status;
        if (query?.search)
            params.search = query.search;
        if (query?.departureAfter)
            params.departureAfter = query.departureAfter;
        if (query?.departureBefore)
            params.departureBefore = query.departureBefore;
        if (query?.origin)
            params.origin = query.origin;
        if (query?.destination)
            params.destination = query.destination;
        const authHeaders = this.extractAuthHeaders(req);
        let payload;
        try {
            payload = await this.forward(() => axios_1.default.get(`${RIDE}/rides/mine`, {
                params,
                headers: authHeaders,
            }), 'ride');
        }
        catch (err) {
            const status = err instanceof common_1.HttpException && typeof err.getStatus === 'function'
                ? err.getStatus()
                : undefined;
            if (status !== 404 && status !== 405) {
                throw err;
            }
            payload = await this.forward(() => axios_1.default.get(`${RIDE}/admin/rides`, {
                params,
                headers: this.internalHeaders(),
            }), 'ride');
        }
        const items = Array.isArray(payload?.data) ? payload.data : [];
        const filtered = items.filter((ride) => ride?.driverId === account.id);
        const ridesWithReservations = await this.attachRideReservations(filtered);
        return {
            data: ridesWithReservations,
            total: ridesWithReservations.length,
            offset: params.offset,
            limit: params.limit,
            summary: this.computeRideSummary(ridesWithReservations),
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
    async requestPasswordReset(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/password/forgot`, body), 'identity');
    }
    async resetPassword(body) {
        return this.forward(() => axios_1.default.post(`${IDENTITY}/auth/password/reset`, body), 'identity');
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
        try {
            const [profileRes, ratingRes] = await Promise.allSettled([
                axios_1.default.get(`${IDENTITY}/profiles/${id}/public`, { headers }),
                axios_1.default.get(`${BOOKING}/ratings/summary/${id}`),
            ]);
            if (profileRes.status === 'rejected') {
                const err = profileRes.reason;
                if (axios_1.default.isAxiosError(err)) {
                    const status = err.response?.status ?? common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                    throw new common_1.HttpException(err.response?.data ?? { error: 'profile_failed' }, status);
                }
                throw new common_1.InternalServerErrorException('profile_failed');
            }
            const ratingSummary = ratingRes.status === 'fulfilled' ? ratingRes.value.data : null;
            return {
                ...profileRes.value.data,
                ratingSummary,
            };
        }
        catch (err) {
            if (axios_1.default.isAxiosError(err)) {
                const status = err.response?.status ?? common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                throw new common_1.HttpException(err.response?.data ?? { error: 'profile_failed' }, status);
            }
            throw new common_1.InternalServerErrorException('profile_failed');
        }
    }
    async createRating(req, body) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        return this.forward(() => axios_1.default.post(`${BOOKING}/ratings`, {
            ...body,
            raterId: account.id,
        }), 'booking');
    }
    async ratingSummary(accountId) {
        return this.forward(() => axios_1.default.get(`${BOOKING}/ratings/summary/${accountId}`), 'booking');
    }
    async ratingForBooking(req, bookingId) {
        const account = await this.fetchMyAccount(req);
        if (!account?.id) {
            throw new common_1.ForbiddenException('auth_required');
        }
        return this.forward(() => axios_1.default.get(`${BOOKING}/ratings/booking/${bookingId}`, {
            params: { raterId: account.id },
        }), 'booking');
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
    async fetchMyAccount(req, options = {}) {
        const headers = this.extractAuthHeaders(req);
        if (!headers.authorization) {
            if (options.allowAnonymous)
                return null;
            throw new common_1.UnauthorizedException('auth_required');
        }
        try {
            return await this.forward(() => axios_1.default.get(`${IDENTITY}/profiles/me`, { headers }), 'identity');
        }
        catch (err) {
            if (err instanceof common_1.HttpException && err.getStatus && err.getStatus() === 401) {
                if (options.allowAnonymous)
                    return null;
                throw new common_1.UnauthorizedException('invalid_token');
            }
            throw err;
        }
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
        return { 'x-internal-key': INTERNAL_KEY, 'x-internal-api-key': INTERNAL_KEY };
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
    computeRideSummary(rides) {
        const now = Date.now();
        const upcoming = rides.filter((ride) => {
            const ts = Date.parse(ride?.departureAt ?? '');
            return Number.isFinite(ts) && ts > now;
        }).length;
        const published = rides.filter((ride) => ride?.status === 'PUBLISHED').length;
        const seatsBooked = rides.reduce((acc, ride) => acc + Math.max(0, (ride?.seatsTotal ?? 0) - (ride?.seatsAvailable ?? 0)), 0);
        const seatsTotal = rides.reduce((acc, ride) => acc + (ride?.seatsTotal ?? 0), 0);
        return { upcoming, published, seatsBooked, seatsTotal };
    }
    async attachRideReservations(rides) {
        if (!rides.length)
            return rides;
        const internalHeaders = this.internalHeaders();
        const reservationsMap = new Map();
        const rideIds = rides.map((ride) => ride.id).filter(Boolean);
        if (rideIds.length) {
            try {
                const res = await axios_1.default.get(`${BOOKING}/admin/bookings/batch`, {
                    params: { rideIds: rideIds.join(',') },
                    headers: internalHeaders,
                });
                const bookings = Array.isArray(res.data?.data) ? res.data.data : [];
                bookings.forEach((booking) => {
                    if (!booking?.rideId)
                        return;
                    const existing = reservationsMap.get(booking.rideId) ?? [];
                    existing.push(booking);
                    reservationsMap.set(booking.rideId, existing);
                });
            }
            catch {
                rideIds.forEach((rideId) => reservationsMap.set(rideId, []));
            }
        }
        const passengerIds = new Set();
        reservationsMap.forEach((reservations) => {
            reservations.forEach((booking) => {
                if (booking?.passengerId)
                    passengerIds.add(booking.passengerId);
            });
        });
        const passengerMap = new Map();
        const passengerIdList = Array.from(passengerIds);
        if (passengerIdList.length) {
            try {
                const res = await axios_1.default.get(`${IDENTITY}/internal/accounts`, {
                    params: { ids: passengerIdList.join(',') },
                    headers: internalHeaders,
                });
                const accounts = Array.isArray(res.data?.data) ? res.data.data : [];
                accounts.forEach((account) => {
                    if (account?.id)
                        passengerMap.set(account.id, account);
                });
            }
            catch {
                passengerIdList.forEach((id) => passengerMap.set(id, { id }));
            }
        }
        return rides.map((ride) => {
            const reservations = reservationsMap.get(ride.id) ?? [];
            const detailedReservations = reservations.map((booking) => {
                const passenger = passengerMap.get(booking.passengerId);
                const passengerName = booking?.passengerName ||
                    passenger?.fullName ||
                    passenger?.companyName ||
                    passenger?.email ||
                    null;
                const passengerEmail = booking?.passengerEmail || passenger?.email || null;
                return {
                    id: booking.id,
                    rideId: booking.rideId,
                    passengerId: booking.passengerId,
                    seats: booking.seats,
                    amount: booking.amount,
                    status: booking.status,
                    referenceCode: booking.referenceCode ?? null,
                    passengerName,
                    passengerEmail,
                    passengerPhone: booking?.passengerPhone || null,
                };
            });
            return {
                ...ride,
                reservations: detailedReservations,
            };
        });
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
    (0, common_1.Get)('me/rides/:rideId/bookings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('rideId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myRideBookings", null);
__decorate([
    (0, common_1.Get)('me/payment-methods'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myPaymentMethods", null);
__decorate([
    (0, common_1.Post)('me/payment-methods'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "addPaymentMethod", null);
__decorate([
    (0, common_1.Delete)('me/payment-methods/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "deletePaymentMethod", null);
__decorate([
    (0, common_1.Post)('me/payment-methods/:id/default'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "setDefaultPaymentMethod", null);
__decorate([
    (0, common_1.Get)('me/wallet'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "getWallet", null);
__decorate([
    (0, common_1.Get)('me/wallet/transactions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "getWalletTransactions", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('me/profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myProfile", null);
__decorate([
    (0, common_1.Post)('bookings'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "booking", null);
__decorate([
    (0, common_1.Get)('booking-reference/:code'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "lookupBookingReference", null);
__decorate([
    (0, common_1.Post)('payments/capture'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
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
    (0, common_1.Post)('me/bookings/:id/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "cancelBooking", null);
__decorate([
    (0, common_1.Get)('me/bookings/:id/receipt'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "bookingReceipt", null);
__decorate([
    (0, common_1.Get)('me/rides'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "myRides", null);
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
    (0, common_1.Post)('auth/password/forgot'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "requestPasswordReset", null);
__decorate([
    (0, common_1.Post)('auth/password/reset'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "resetPassword", null);
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
    (0, common_1.Post)('ratings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "createRating", null);
__decorate([
    (0, common_1.Get)('ratings/summary/:accountId'),
    __param(0, (0, common_1.Param)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "ratingSummary", null);
__decorate([
    (0, common_1.Get)('ratings/booking/:bookingId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProxyController.prototype, "ratingForBooking", null);
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