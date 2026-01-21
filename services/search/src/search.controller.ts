import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { GeoService } from './geo/geo';
import { MeiliService, RideDoc } from './meili.service';

type SearchQuery = {
  from: string;
  to: string;
  date?: string;
  seats?: string;
  priceMax?: string;
  departureAfter?: string;
  departureBefore?: string;
  sort?: 'soonest' | 'cheapest' | 'seats' | 'smart';
  liveTracking?: string;
  comfort?: string;
  driverVerified?: string;
  emailVerified?: string;
  phoneVerified?: string;
  meta?: string;
};

function normalizeDateRange(input: string): { start: string; end: string } | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  const base = new Date(trimmed);
  if (Number.isNaN(base.getTime())) return null;
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function parseTimeOfDay(value?: string): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const [hh, mm = '0'] = trimmed.split(':', 2);
  const hour = Number(hh);
  const minutes = Number(mm);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minutes) ||
    hour < 0 ||
    hour > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }
  return hour * 60 + minutes;
}

function parseBoolean(value?: string): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'oui', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'non', 'off'].includes(normalized)) return false;
  return undefined;
}

@Controller('search')
export class SearchController {
  constructor(
    private readonly geo: GeoService,
    private readonly meili: MeiliService,
  ) {}

  @Get()
  async search(@Query() q: SearchQuery): Promise<RideDoc[] | { hits: RideDoc[]; meta: any }> {
    const from = q.from?.trim();
    const to = q.to?.trim();
    if (!from || !to) throw new BadRequestException('from & to requis');

    const wantMeta = parseBoolean(q.meta) === true;
    const resolvedFrom = this.geo.resolveCity(from);
    const resolvedTo = this.geo.resolveCity(to);
    const cFrom = resolvedFrom.city;
    const cTo = resolvedTo.city;
    if (!cFrom || !cTo) {
      if (wantMeta) {
        return {
          hits: [],
          meta: {
            from: {
              input: from,
              resolved: cFrom?.name ?? null,
              matchType: resolvedFrom.matchType ?? null,
              suggestions: resolvedFrom.suggestions ?? [],
            },
            to: {
              input: to,
              resolved: cTo?.name ?? null,
              matchType: resolvedTo.matchType ?? null,
              suggestions: resolvedTo.suggestions ?? [],
            },
            error: 'Ville inconnue',
          },
        };
      }
      throw new BadRequestException('Ville inconnue');
    }

    const rawDateRange = q.date ? normalizeDateRange(q.date) : undefined;
    if (q.date && !rawDateRange) throw new BadRequestException('Date invalide');
    const dateRange = rawDateRange ?? undefined;

    const minSeats = q.seats ? Number(q.seats) : undefined;
    if (q.seats && (minSeats === undefined || !Number.isFinite(minSeats) || minSeats <= 0))
      throw new BadRequestException('Seats invalide');

    const maxPrice = q.priceMax ? Number(q.priceMax) : undefined;
    if (q.priceMax && (maxPrice === undefined || !Number.isFinite(maxPrice) || maxPrice <= 0))
      throw new BadRequestException('priceMax invalide');

    const departureAfterMinutes = parseTimeOfDay(q.departureAfter);
    if (q.departureAfter && departureAfterMinutes === undefined)
      throw new BadRequestException('departureAfter invalide (HH:mm)');

    const departureBeforeMinutes = parseTimeOfDay(q.departureBefore);
    if (q.departureBefore && departureBeforeMinutes === undefined)
      throw new BadRequestException('departureBefore invalide (HH:mm)');
    if (
      departureAfterMinutes !== undefined &&
      departureBeforeMinutes !== undefined &&
      departureAfterMinutes > departureBeforeMinutes
    ) {
      throw new BadRequestException('Fenêtre horaire incohérente');
    }

    const liveTrackingOnly = parseBoolean(q.liveTracking);
    if (q.liveTracking && liveTrackingOnly === undefined) {
      throw new BadRequestException('liveTracking invalide');
    }

    const driverVerifiedOnly = parseBoolean(q.driverVerified);
    if (q.driverVerified && driverVerifiedOnly === undefined) {
      throw new BadRequestException('driverVerified invalide');
    }
    const emailVerifiedOnly = parseBoolean(q.emailVerified);
    if (q.emailVerified && emailVerifiedOnly === undefined) {
      throw new BadRequestException('emailVerified invalide');
    }
    const phoneVerifiedOnly = parseBoolean(q.phoneVerified);
    if (q.phoneVerified && phoneVerifiedOnly === undefined) {
      throw new BadRequestException('phoneVerified invalide');
    }

    const comfortLevel = q.comfort?.trim();

    let sort = q.sort ?? 'soonest';
    if (!['soonest', 'cheapest', 'seats', 'smart'].includes(sort)) {
      sort = 'soonest';
    }

    const RADIUS_KM = Number(process.env.NEAR_RADIUS_KM ?? 80);
    const BUFFER_KM = Number(process.env.CORRIDOR_KM ?? 45);
    const LIMIT = Number(process.env.SEARCH_LIMIT ?? 60);

    // 1) élargir l’espace Meili par proximité de villes
    const nearFrom = this.geo.nearbyCities(cFrom.name, RADIUS_KM);
    const nearTo = this.geo.nearbyCities(cTo.name, RADIUS_KM);

    // 2) première passe Meili
    const hits = await this.meili.searchByCities(
      nearFrom,
      nearTo,
      LIMIT,
      dateRange,
      minSeats,
      maxPrice,
      liveTrackingOnly === true,
      comfortLevel,
      driverVerifiedOnly === true,
      emailVerifiedOnly === true,
      phoneVerifiedOnly === true,
    );
    if (!hits.length) {
      if (wantMeta) {
        return {
          hits: [],
          meta: {
            from: {
              input: from,
              resolved: cFrom.name,
              matchType: resolvedFrom.matchType ?? null,
              suggestions: resolvedFrom.suggestions ?? [],
            },
            to: {
              input: to,
              resolved: cTo.name,
              matchType: resolvedTo.matchType ?? null,
              suggestions: resolvedTo.suggestions ?? [],
            },
            filters: {
              seats: minSeats,
              priceMax: maxPrice,
              departureAfterMinutes,
              departureBeforeMinutes,
              liveTracking: liveTrackingOnly === true,
              comfort: comfortLevel ?? null,
              driverVerified: driverVerifiedOnly === true,
              emailVerified: emailVerifiedOnly === true,
              phoneVerified: phoneVerifiedOnly === true,
              sort,
            },
          },
        };
      }
      return [];
    }

    // 3) filtrage corridor (trajet qui passe “près de” les points from/to) + sens (a.t < b.t)
    const cityCache = new Map<string, ReturnType<GeoService['getCity']>>();
    const getCityCached = (name: string) => {
      if (cityCache.has(name)) return cityCache.get(name);
      const city = this.geo.getCity(name);
      cityCache.set(name, city);
      return city;
    };

    const filtered = hits.filter((r) => {
      const o = getCityCached(r.originCity);
      const d = getCityCached(r.destinationCity);
      if (!o || !d) return false;
      const a = this.geo.isNearCorridor(cFrom, o, d, BUFFER_KM);
      const b = this.geo.isNearCorridor(cTo, o, d, BUFFER_KM);
      if (!(a.ok && b.ok && a.t < b.t)) return false;
      if (typeof minSeats === 'number' && r.seatsAvailable < minSeats) return false;
      if (typeof maxPrice === 'number' && r.pricePerSeat > maxPrice) return false;

      if (departureAfterMinutes !== undefined || departureBeforeMinutes !== undefined) {
        const dep = new Date(r.departureAt);
        const depMinutes = dep.getUTCHours() * 60 + dep.getUTCMinutes();
        if (departureAfterMinutes !== undefined && depMinutes < departureAfterMinutes) {
          return false;
        }
        if (departureBeforeMinutes !== undefined && depMinutes > departureBeforeMinutes) {
          return false;
        }
      }
      return true;
    });

    // 4) tri (heure de départ puis prix)
    filtered.sort((x, y) => {
      if (sort === 'cheapest') {
        if (x.pricePerSeat === y.pricePerSeat) {
          return x.departureAt < y.departureAt ? -1 : 1;
        }
        return x.pricePerSeat - y.pricePerSeat;
      }
      if (sort === 'seats') {
        if (x.seatsAvailable === y.seatsAvailable) {
          return x.departureAt < y.departureAt ? -1 : 1;
        }
        return y.seatsAvailable - x.seatsAvailable;
      }
      if (sort === 'smart') {
        const targetTime = dateRange?.start ? Date.parse(dateRange.start) : Date.now();
        const score = (ride: RideDoc) => {
          const dep = Date.parse(ride.departureAt);
          const delta = Number.isFinite(dep) ? Math.abs(dep - targetTime) : 1e12;
          const timeScore = Math.max(0, 1 - delta / (1000 * 60 * 60 * 24));
          const seatsScore = Math.min(1, ride.seatsAvailable / 4);
          const verifiedScore = ride.driverVerified ? 0.2 : 0;
          const trackingScore = ride.liveTrackingEnabled ? 0.1 : 0;
          return timeScore + seatsScore + verifiedScore + trackingScore;
        };
        const diff = score(y) - score(x);
        if (Math.abs(diff) > 0.001) return diff > 0 ? 1 : -1;
      }
      // default: soonest
      if (x.departureAt === y.departureAt) {
        return x.pricePerSeat - y.pricePerSeat;
      }
      return x.departureAt < y.departureAt ? -1 : 1;
    });

    if (wantMeta) {
      return {
        hits: filtered,
        meta: {
          from: {
            input: from,
            resolved: cFrom.name,
            matchType: resolvedFrom.matchType ?? null,
            suggestions: resolvedFrom.suggestions ?? [],
          },
          to: {
            input: to,
            resolved: cTo.name,
            matchType: resolvedTo.matchType ?? null,
            suggestions: resolvedTo.suggestions ?? [],
          },
          filters: {
            seats: minSeats,
            priceMax: maxPrice,
            departureAfterMinutes,
            departureBeforeMinutes,
            liveTracking: liveTrackingOnly === true,
            comfort: comfortLevel ?? null,
            driverVerified: driverVerifiedOnly === true,
            emailVerified: emailVerifiedOnly === true,
            phoneVerified: phoneVerifiedOnly === true,
            sort,
          },
        },
      };
    }

    return filtered;
  }
}
