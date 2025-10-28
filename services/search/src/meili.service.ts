import { Injectable, Logger } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';

export type RideDoc = {
  rideId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsTotal: number;
  seatsAvailable: number;
  driverId: string;
  status: string;
};

@Injectable()
export class MeiliService {
  private client!: MeiliSearch;
  private rides!: any;
  private readonly logger = new Logger(MeiliService.name);

  async init() {
    const host = process.env.MEILISEARCH_URL || 'http://meilisearch:7700';
    this.client = new MeiliSearch({ host });

    try {
      const res = await this.client
        .createIndex('rides', { primaryKey: 'rideId' })
        .catch((e: any) => e);
      if (res?.taskUid) await this.client.waitForTask(res.taskUid);
    } catch (e: any) {
      if (e?.code !== 'index_already_exists' && e?.statusCode !== 409) {
        this.logger.warn(`createIndex error: ${e?.message || e}`);
      }
    }

    this.rides = this.client.index('rides');

    try {
      const task = await this.rides.updateSettings({
        searchableAttributes: ['originCity', 'destinationCity'],
        filterableAttributes: [
          'originCity',
          'destinationCity',
          'departureAt',
          'pricePerSeat',
          'seatsAvailable',
        ],
      });
      if (task?.taskUid) await this.client.waitForTask(task.taskUid);
    } catch (e: any) {
      this.logger.warn(`updateSettings error: ${e?.message || e}`);
    }
  }

  private normalize(evt: any): RideDoc {
    const rideId = evt.rideId || evt.id;
    return {
      rideId,
      originCity: evt.originCity,
      destinationCity: evt.destinationCity,
      departureAt: evt.departureAt,
      pricePerSeat: Number(evt.pricePerSeat ?? 0),
      seatsTotal: Number(evt.seatsTotal ?? 0),
      seatsAvailable: Number(evt.seatsAvailable ?? 0),
      driverId: evt.driverId,
      status: evt.status,
    };
  }

  async indexRide(evt: any) {
    const doc = this.normalize(evt);
    if (!doc.rideId) throw new Error('missing rideId');
    const task = await this.rides.addDocuments([doc]);
    if (task?.taskUid) await this.client.waitForTask(task.taskUid);
  }

  /** Recherche Meili avec IN filters (villes candidates élargies). */
  async searchByCities(
    fromCandidates: string[],
    toCandidates: string[],
    limit = 60,
    dateRange?: { start: string; end: string },
    minSeats?: number,
    maxPrice?: number,
  ): Promise<RideDoc[]> {
    const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
    const filters: string[] = [];
    if (fromCandidates.length)
      filters.push(
        `originCity IN [${fromCandidates.map(quote).join(', ')}]`,
      );
    if (toCandidates.length)
      filters.push(`destinationCity IN [${toCandidates.map(quote).join(', ')}]`);
    if (dateRange) {
      filters.push(`departureAt >= ${quote(dateRange.start)}`);
      filters.push(`departureAt < ${quote(dateRange.end)}`);
    }
    if (typeof minSeats === 'number') {
      filters.push(`seatsAvailable >= ${Math.max(1, Math.floor(minSeats))}`);
    }
    if (typeof maxPrice === 'number') {
      filters.push(`pricePerSeat <= ${Math.max(0, Math.floor(maxPrice))}`);
    }
    const opts: any = { limit };
    if (filters.length) opts.filter = filters.join(' AND ');
    const res = await this.rides.search('', opts);
    return (res.hits ?? []) as RideDoc[];
  }

  /** 🔁 Compatibilité : ancienne signature `search(params)` */
  async search(params: { from?: string; to?: string; limit?: number; seats?: number }) {
    const limit = Number(params?.limit ?? process.env.SEARCH_LIMIT ?? 60);
    const from = params?.from ? [params.from] : [];
    const to = params?.to ? [params.to] : [];
    return this.searchByCities(from, to, limit, undefined, params?.seats, undefined);
  }
}
