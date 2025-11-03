import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities';
import { AdminSendRideDigestDto } from './dto';
import { MailerService } from './mailer.service';
import { adminRideDigestCounter } from './metrics';

type RideAdminItem = {
  id: string;
  driverId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number;
  status: 'PUBLISHED' | 'CLOSED';
  createdAt: string;
};

type RideAdminSummary = {
  upcoming: number;
  published: number;
  seatsBooked: number;
  seatsTotal: number;
  averagePrice?: number;
  occupancyRate?: number;
  byStatus?: Record<string, number>;
  topRoutes?: Array<{ origin: string; destination: string; count: number }>;
};

type RideAdminResponse = {
  data: RideAdminItem[];
  total: number;
  offset: number;
  limit: number;
  summary: RideAdminSummary;
};

type DigestEmailPayload = {
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
};

type RideDigestInsights = {
  nextDeparture: RideAdminItem | null;
  averageSeats: number;
  occupancyRate: number;
  averagePrice?: number;
  topRoutes: Array<{ origin: string; destination: string; count: number }>;
};

type DigestRecipient = Pick<Account, 'email' | 'fullName' | 'companyName'> & Partial<Account>;

@Injectable()
export class AdminRideService {
  private readonly logger = new Logger(AdminRideService.name);
  private readonly rideBaseUrl =
    process.env.RIDE_INTERNAL_URL || process.env.RIDE_URL || 'http://ride:3002';
  private readonly internalKey = process.env.INTERNAL_API_KEY || 'super-internal-key';

  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly mailer: MailerService,
  ) {}

  async sendRideDigest(dto: AdminSendRideDigestDto, actorId?: string) {
    const email = dto.recipient.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('recipient_required');
    }

    const accountRecipient = await this.accounts.findOne({ where: { email } });
    const recipient: DigestRecipient =
      accountRecipient ??
      ({
        email,
        fullName: email.split('@')[0],
      } as DigestRecipient);

    const actor = actorId ? await this.accounts.findOne({ where: { id: actorId } }) : null;

    const params = this.buildQueryParams(dto, accountRecipient);
    let ridesResponse: RideAdminResponse;

    try {
      const { data } = await axios.get<RideAdminResponse>(`${this.rideBaseUrl}/admin/rides`, {
        params,
        headers: { 'x-internal-key': this.internalKey },
      });
      ridesResponse = data;
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch rides digest for ${email}: ${err?.message || err}`,
      );
      adminRideDigestCounter.inc({ result: 'fetch_failed' });
      throw new BadRequestException('ride_fetch_failed');
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
      adminRideDigestCounter.inc({ result: 'empty' });
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
    adminRideDigestCounter.inc({ result: delivered ? 'sent' : 'failed' });

    return {
      delivered,
      summary,
      insights,
      count: rides.length,
    };
  }

  private buildQueryParams(dto: AdminSendRideDigestDto, recipient: Account | null) {
    const limit = Math.min(Math.max(dto.limit ?? 50, 1), 500);
    const params: Record<string, any> = {
      limit,
      status: dto.status && dto.status !== 'ALL' ? dto.status : undefined,
    };

    if (dto.targetScope === 'ACCOUNT_ONLY') {
      if (recipient?.id) {
        params.driverId = recipient.id;
      } else if (dto.driverId) {
        params.driverId = dto.driverId;
      } else {
        throw new BadRequestException('recipient_scope_requires_account');
      }
    } else if (dto.driverId) {
      params.driverId = dto.driverId;
    }
    if (dto.origin) params.origin = dto.origin;
    if (dto.destination) params.destination = dto.destination;
    if (dto.departureAfter) params.departureAfter = dto.departureAfter;
    if (dto.departureBefore) params.departureBefore = dto.departureBefore;
    params.sort = 'departure_asc';
    return params;
  }

  private computeSummary(rides: RideAdminItem[]): RideAdminSummary {
    const now = Date.now();
    const upcoming = rides.filter((ride) => Date.parse(ride.departureAt) > now).length;
    const published = rides.filter((ride) => ride.status === 'PUBLISHED').length;
    const seatsBooked = rides.reduce(
      (acc, ride) => acc + (ride.seatsTotal - ride.seatsAvailable),
      0,
    );
    const seatsTotal = rides.reduce((acc, ride) => acc + ride.seatsTotal, 0);
    const averagePrice =
      rides.length > 0
        ? Math.round(
            rides.reduce((acc, ride) => acc + ride.pricePerSeat, 0) / rides.length,
          )
        : 0;
    const occupancyRate = seatsTotal > 0 ? seatsBooked / seatsTotal : 0;
    const byStatus = rides.reduce<Record<string, number>>((acc, ride) => {
      acc[ride.status] = (acc[ride.status] ?? 0) + 1;
      return acc;
    }, {});
    const topRoutes = rides
      .reduce<Record<string, { origin: string; destination: string; count: number }>>(
        (acc, ride) => {
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
        },
        {},
      );

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

  private computeInsights(rides: RideAdminItem[], summary: RideAdminSummary): RideDigestInsights {
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

  private composeCsv(rides: RideAdminItem[]) {
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

  private composeEmailPayload({
    recipient,
    actor,
    rides,
    summary,
    insights,
    dto,
  }: {
    recipient: DigestRecipient;
    actor: Account | null;
    rides: RideAdminItem[];
    summary: RideAdminSummary;
    insights?: RideDigestInsights;
    dto: AdminSendRideDigestDto;
  }): DigestEmailPayload {
    const friendlyName =
      recipient.fullName ||
      recipient.companyName ||
      recipient.email.split('@')[0] ||
      'utilisateur';
    const actorName =
      actor?.fullName || actor?.companyName || actor?.email || 'un administrateur KariGo';
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
        <td style="padding:4px 8px;">${ride.originCity}</td>
        <td style="padding:4px 8px;">${ride.destinationCity}</td>
        <td style="padding:4px 8px;">${when}</td>
        <td style="padding:4px 8px; text-align:center;">${occupancy}</td>
        <td style="padding:4px 8px; text-align:right;">${ride.pricePerSeat} XOF</td>
      </tr>`;
    });

    const topRoutesHtml =
      insights?.topRoutes && insights.topRoutes.length
        ? `<p><strong>Itineraires populaires :</strong><br>${insights.topRoutes
            .map((route) => `${route.origin} → ${route.destination} (${route.count})`)
            .join('<br>')}</p>`
        : '';

    const html = `
      <div style="font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1f2937;">
        <p>Bonjour ${friendlyName},</p>
        <p>${actorName} vous partage un aperçu de ${rides.length} trajet(s) KariGo.</p>
        ${dto.message?.trim() ? `<p style="padding:12px 16px;border-left:3px solid #38bdf8;background:#f0f9ff;">${this.escapeHtml(dto.message.trim())}</p>` : ''}
        <p><strong>En un clin d'œil :</strong></p>
        <ul>
          <li>${summary.upcoming} départ(s) à venir</li>
          <li>Taux de remplissage moyen : ${occupancyPercent} %</li>
          <li>Prix moyen : ${summary.averagePrice ?? 0} XOF</li>
        </ul>
        ${insights?.nextDeparture ? `<p>Prochain départ : ${insights.nextDeparture.originCity} → ${insights.nextDeparture.destinationCity} (${this.formatDate(insights.nextDeparture.departureAt)}).</p>` : ''}
        ${topRoutesHtml}
        <table style="border-collapse:collapse;width:100%;margin-top:12px;">
          <thead>
            <tr style="background:#0ea5e9;color:white;">
              <th style="padding:6px 8px;text-align:left;">Origine</th>
              <th style="padding:6px 8px;text-align:left;">Destination</th>
              <th style="padding:6px 8px;text-align:left;">Départ</th>
              <th style="padding:6px 8px;text-align:center;">Remplissage</th>
              <th style="padding:6px 8px;text-align:right;">Prix</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRideRows.join('')}
          </tbody>
        </table>
        ${rides.length > 10 ? `<p style="margin-top:12px;">${rides.length - 10} trajet(s) supplémentaire(s) sont disponibles dans la pièce jointe CSV.</p>` : ''}
        <p style="margin-top:20px;">À très vite,<br>L'équipe KariGo</p>
      </div>
    `;

    return { subject, text, html };
  }

  private formatDate(input: string) {
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) return input;
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sanitizeCsv(value: string) {
    const safe = value.replace(/"/g, '""');
    if (safe.includes(',') || safe.includes('"')) {
      return `"${safe}"`;
    }
    return safe;
  }
}
