import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { GeoService } from './geo/geo';
import { MeiliService, RideDoc } from './meili.service';

type SearchQuery = { from: string; to: string; date?: string };

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

@Controller('search')
export class SearchController {
  constructor(
    private readonly geo: GeoService,
    private readonly meili: MeiliService,
  ) {}

  @Get()
  async search(@Query() q: SearchQuery): Promise<RideDoc[]> {
    const from = q.from?.trim();
    const to = q.to?.trim();
    if (!from || !to) throw new BadRequestException('from & to requis');

    const cFrom = this.geo.getCity(from);
    const cTo = this.geo.getCity(to);
    if (!cFrom || !cTo) throw new BadRequestException('Ville inconnue');

    const rawDateRange = q.date ? normalizeDateRange(q.date) : undefined;
    if (q.date && !rawDateRange) throw new BadRequestException('Date invalide');
    const dateRange = rawDateRange ?? undefined;

    const RADIUS_KM = Number(process.env.NEAR_RADIUS_KM ?? 80);
    const BUFFER_KM = Number(process.env.CORRIDOR_KM ?? 45);
    const LIMIT = Number(process.env.SEARCH_LIMIT ?? 60);

    // 1) élargir l’espace Meili par proximité de villes
    const nearFrom = this.geo.nearbyCities(from, RADIUS_KM);
    const nearTo = this.geo.nearbyCities(to, RADIUS_KM);

    // 2) première passe Meili
    const hits = await this.meili.searchByCities(nearFrom, nearTo, LIMIT, dateRange);
    if (!hits.length) return [];

    // 3) filtrage corridor (trajet qui passe “près de” les points from/to) + sens (a.t < b.t)
    const filtered = hits.filter((r) => {
      const o = this.geo.getCity(r.originCity);
      const d = this.geo.getCity(r.destinationCity);
      if (!o || !d) return false;
      const a = this.geo.isNearCorridor(cFrom, o, d, BUFFER_KM);
      const b = this.geo.isNearCorridor(cTo, o, d, BUFFER_KM);
      return a.ok && b.ok && a.t < b.t;
    });

    // 4) tri (heure de départ puis prix)
    filtered.sort((x, y) => {
      if (x.departureAt === y.departureAt) {
        return x.pricePerSeat - y.pricePerSeat;
      }
      return x.departureAt < y.departureAt ? -1 : 1;
    });

    return filtered;
  }
}
