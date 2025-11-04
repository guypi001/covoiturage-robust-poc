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
var AdminRideService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRideService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const mailer_service_1 = require("./mailer.service");
const metrics_1 = require("./metrics");
let AdminRideService = AdminRideService_1 = class AdminRideService {
    constructor(accounts, mailer) {
        this.accounts = accounts;
        this.mailer = mailer;
        this.logger = new common_1.Logger(AdminRideService_1.name);
        this.rideBaseUrl = process.env.RIDE_INTERNAL_URL || process.env.RIDE_URL || 'http://ride:3002';
        this.internalKey = process.env.INTERNAL_API_KEY || 'super-internal-key';
    }
    async sendRideDigest(dto, actorId) {
        const email = dto.recipient.trim().toLowerCase();
        if (!email) {
            throw new common_1.BadRequestException('recipient_required');
        }
        const accountRecipient = await this.accounts.findOne({ where: { email } });
        const recipient = accountRecipient ??
            {
                email,
                fullName: email.split('@')[0],
            };
        const actor = actorId ? await this.accounts.findOne({ where: { id: actorId } }) : null;
        const params = this.buildQueryParams(dto, accountRecipient);
        let ridesResponse;
        try {
            const { data } = await axios_1.default.get(`${this.rideBaseUrl}/admin/rides`, {
                params,
                headers: { 'x-internal-key': this.internalKey },
            });
            ridesResponse = data;
        }
        catch (err) {
            this.logger.error(`Failed to fetch rides digest for ${email}: ${err?.message || err}`);
            metrics_1.adminRideDigestCounter.inc({ result: 'fetch_failed' });
            throw new common_1.BadRequestException('ride_fetch_failed');
        }
        let rides = Array.isArray(ridesResponse?.data) ? ridesResponse.data : [];
        if (dto.includeUpcomingOnly) {
            const now = Date.now();
            rides = rides.filter((ride) => {
                const ts = Date.parse(ride.departureAt);
                return Number.isFinite(ts) && ts > now;
            });
        }
        const summary = this.computeSummary(rides);
        const insights = dto.includeInsights === false ? undefined : this.computeInsights(rides, summary);
        if (!rides.length) {
            metrics_1.adminRideDigestCounter.inc({ result: 'empty' });
            return {
                delivered: false,
                reason: 'empty',
                summary,
                insights,
            };
        }
        const emailPayload = this.composeEmailPayload({
            recipient,
            actor,
            rides,
            summary,
            insights,
            dto,
        });
        if (dto.attachCsv !== false) {
            const csv = this.composeCsv(rides);
            emailPayload.attachments = [
                ...(emailPayload.attachments ?? []),
                {
                    filename: 'rides-digest.csv',
                    content: csv,
                    contentType: 'text/csv',
                },
            ];
        }
        const delivered = await this.mailer.sendRideDigestEmail(email, emailPayload);
        metrics_1.adminRideDigestCounter.inc({ result: delivered ? 'sent' : 'failed' });
        return {
            delivered,
            summary,
            insights,
            count: rides.length,
        };
    }
    buildQueryParams(dto, recipient) {
        const limit = Math.min(Math.max(dto.limit ?? 50, 1), 500);
        const params = {
            limit,
            status: dto.status && dto.status !== 'ALL' ? dto.status : undefined,
        };
        if (dto.targetScope === 'ACCOUNT_ONLY') {
            if (recipient?.id) {
                params.driverId = recipient.id;
            }
            else if (dto.driverId) {
                params.driverId = dto.driverId;
            }
            else {
                throw new common_1.BadRequestException('recipient_scope_requires_account');
            }
        }
        else if (dto.driverId) {
            params.driverId = dto.driverId;
        }
        if (dto.origin)
            params.origin = dto.origin;
        if (dto.destination)
            params.destination = dto.destination;
        if (dto.departureAfter)
            params.departureAfter = dto.departureAfter;
        if (dto.departureBefore)
            params.departureBefore = dto.departureBefore;
        params.sort = 'departure_asc';
        return params;
    }
    computeSummary(rides) {
        const now = Date.now();
        const upcoming = rides.filter((ride) => Date.parse(ride.departureAt) > now).length;
        const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
        const seatsBooked = rides.reduce((acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable), 0);
        const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
        const averagePrice = rides.length > 0
            ? Math.round(rides.reduce((acc, ride) => acc + ride.pricePerSeat, 0) / rides.length)
            : 0;
        const occupancyRate = seatsTotal > 0 ? seatsBooked / seatsTotal : 0;
        const byStatus = rides.reduce((acc, ride) => {
            acc[ride.status] = (acc[ride.status] ?? 0) + 1;
            return acc;
        }, {});
        const topRoutes = rides
            .reduce((acc, ride) => {
            const key = `${ride.originCity}→${ride.destinationCity}`;
            if (!acc[key]) {
                acc[key] = {
                    origin: ride.originCity,
                    destination: ride.destinationCity,
                    count: 0,
                };
            }
            acc[key].count += 1;
            return acc;
        }, {});
        return {
            upcoming,
            published,
            seatsBooked,
            seatsTotal,
            averagePrice,
            occupancyRate,
            byStatus,
            topRoutes: Object.values(topRoutes).sort((a, b) => b.count - a.count).slice(0, 5),
        };
    }
    computeInsights(rides, summary) {
        const now = Date.now();
        const nextRide = rides
            .map((ride) => ({ ride, ts: Date.parse(ride.departureAt) }))
            .filter((item) => Number.isFinite(item.ts) && item.ts > now)
            .sort((a, b) => a.ts - b.ts)[0];
        const avgSeats = rides.length > 0
            ? rides.reduce((acc, ride) => acc + ride.seatsTotal, 0) / rides.length
            : 0;
        return {
            nextDeparture: nextRide?.ride ?? null,
            averageSeats: Math.round(avgSeats * 10) / 10,
            occupancyRate: summary.occupancyRate ?? 0,
            averagePrice: summary.averagePrice ?? 0,
            topRoutes: summary.topRoutes ?? [],
        };
    }
    composeCsv(rides) {
        const header = [
            'ride_id',
            'driver_id',
            'origin',
            'destination',
            'departure_at',
            'seats_total',
            'seats_available',
            'price_per_seat',
            'status',
        ];
        const rows = rides.map((ride) => [
            ride.id,
            ride.driverId,
            this.sanitizeCsv(ride.originCity),
            this.sanitizeCsv(ride.destinationCity),
            new Date(ride.departureAt).toISOString(),
            String(ride.seatsTotal),
            String(ride.seatsAvailable),
            String(ride.pricePerSeat),
            ride.status,
        ]);
        return [header, ...rows].map((row) => row.join(',')).join('\n');
    }
    composeEmailPayload({ recipient, actor, rides, summary, insights, dto, }) {
        const friendlyName = recipient.fullName ||
            recipient.companyName ||
            recipient.email.split('@')[0] ||
            'utilisateur';
        const actorName = actor?.fullName || actor?.companyName || actor?.email || 'un administrateur KariGo';
        const subject = `Apercu de vos trajets (${rides.length})`;
        const introLines = [
            `Bonjour ${friendlyName},`,
            `${actorName} vous partage un apercu de ${rides.length} trajet(s) KariGo.`,
        ];
        if (dto.message?.trim()) {
            introLines.push('');
            introLines.push(dto.message.trim());
        }
        const rideLines = rides.slice(0, 10).map((ride, index) => {
            const when = this.formatDate(ride.departureAt);
            const occupancy = `${ride.seatsTotal - ride.seatsAvailable}/${ride.seatsTotal}`;
            return `${index + 1}. ${ride.originCity} → ${ride.destinationCity} – ${when} – ${occupancy} places – ${ride.pricePerSeat} XOF`;
        });
        const occupancyPercent = ((summary.occupancyRate ?? 0) * 100).toFixed(1);
        const textSummary = [
            `• Trajets à venir : ${summary.upcoming}`,
            `• Taux de remplissage moyen : ${occupancyPercent} %`,
            `• Prix moyen : ${summary.averagePrice ?? 0} XOF`,
        ];
        const footer = [
            '',
            rides.length > 10 ? `(${rides.length - 10} trajet(s) supplémentaire(s) dans la pièce jointe CSV.)` : '',
            '---',
            'Equipe KariGo',
        ].filter(Boolean);
        const text = [...introLines, '', ...textSummary, '', ...rideLines, ...footer].join('\n');
        const htmlRideRows = rides.slice(0, 10).map((ride) => {
            const when = this.formatDate(ride.departureAt);
            const occupancy = `${ride.seatsTotal - ride.seatsAvailable}/${ride.seatsTotal}`;
            return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${ride.originCity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${ride.destinationCity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${when}</td>
        <td style="padding:10px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">${occupancy}</td>
        <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">${ride.pricePerSeat} XOF</td>
      </tr>`;
        });
        const topRoutesHtml = insights?.topRoutes && insights.topRoutes.length
            ? `<p style="margin:16px 0 0 0;font-size:13px;color:#475569;">
            <strong>Itinéraires populaires :</strong><br />
            ${insights.topRoutes
                .map((route) => `${route.origin} → ${route.destination} (${route.count})`)
                .join('<br />')}
          </p>`
            : '';
        const htmlContent = `
      ${dto.message?.trim() ? `<p style="padding:12px 16px;border-left:3px solid #38bdf8;background:#e0f2fe;border-radius:12px;color:#0f172a;">${this.escapeHtml(dto.message.trim())}</p>` : ''}
      <p style="margin:16px 0 4px 0;font-size:14px;color:#0f172a;"><strong>En un clin d'œil :</strong></p>
      <ul style="margin:0 0 16px 16px;padding:0;color:#334155;font-size:14px;line-height:1.6;">
        <li>${summary.upcoming} départ(s) à venir</li>
        <li>Taux de remplissage moyen : ${occupancyPercent} %</li>
        <li>Prix moyen : ${summary.averagePrice ?? 0} XOF</li>
      </ul>
      ${insights?.nextDeparture
            ? `<p style="margin:0 0 16px 0;font-size:13px;color:#475569;">Prochain départ : <strong>${insights.nextDeparture.originCity} → ${insights.nextDeparture.destinationCity}</strong> (${this.formatDate(insights.nextDeparture.departureAt)}).</p>`
            : ''}
      ${topRoutesHtml}
      <table style="border-collapse:collapse;width:100%;margin-top:12px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <thead>
          <tr style="background:#0ea5e9;color:white;">
            <th style="padding:10px 8px;text-align:left;">Origine</th>
            <th style="padding:10px 8px;text-align:left;">Destination</th>
            <th style="padding:10px 8px;text-align:left;">Départ</th>
            <th style="padding:10px 8px;text-align:center;">Remplissage</th>
            <th style="padding:10px 8px;text-align:right;">Prix</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRideRows.join('')}
        </tbody>
      </table>
      ${rides.length > 10
            ? `<p style="margin-top:16px;font-size:13px;color:#475569;">${rides.length - 10} trajet(s) supplémentaire(s) sont disponibles dans la pièce jointe CSV.</p>`
            : ''}
    `;
        const html = this.mailer.renderTemplate({
            title: 'Digest de vos trajets',
            intro: `${actorName} vous partage une sélection de ${rides.length} trajet(s) KariGo.`,
            bodyHtml: htmlContent,
            previewText: `${rides.length} trajets · ${summary.upcoming} départs à venir`,
            ctaLabel: 'Ouvrir mon espace',
            ctaUrl: `${process.env.APP_BASE_URL ?? 'https://app.karigo.ci'}/admin/accounts`,
        });
        return { subject, text, html };
    }
    formatDate(input) {
        const date = new Date(input);
        if (!Number.isFinite(date.getTime()))
            return input;
        return date.toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    sanitizeCsv(value) {
        const safe = value.replace(/"/g, '""');
        if (safe.includes(',') || safe.includes('"')) {
            return `"${safe}"`;
        }
        return safe;
    }
};
exports.AdminRideService = AdminRideService;
exports.AdminRideService = AdminRideService = AdminRideService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Account)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        mailer_service_1.MailerService])
], AdminRideService);
//# sourceMappingURL=admin-rides.service.js.map