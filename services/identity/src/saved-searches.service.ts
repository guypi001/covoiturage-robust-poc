import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from './entities';

type SavedSearchInput = {
  originCity: string;
  destinationCity: string;
  date?: string;
  seats?: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  liveTracking?: boolean;
  comfortLevel?: string;
  driverVerified?: boolean;
};

const normalizeCity = (value: string) => value.trim();

@Injectable()
export class SavedSearchesService {
  constructor(@InjectRepository(SavedSearch) private readonly searches: Repository<SavedSearch>) {}

  async listForAccount(accountId: string) {
    return this.searches.find({
      where: { accountId },
      order: { updatedAt: 'DESC' },
    });
  }

  async create(accountId: string, input: SavedSearchInput) {
    const originCity = normalizeCity(input.originCity);
    const destinationCity = normalizeCity(input.destinationCity);
    const date = input.date ? new Date(input.date) : null;

    const existing = await this.searches.findOne({
      where: {
        accountId,
        originCity,
        destinationCity,
        date,
        seats: input.seats ?? null,
        priceMax: input.priceMax ?? null,
        departureAfter: input.departureAfter ?? null,
        departureBefore: input.departureBefore ?? null,
        liveTracking: Boolean(input.liveTracking),
        comfortLevel: input.comfortLevel?.trim() || null,
        driverVerified: Boolean(input.driverVerified),
      },
    });
    if (existing) return existing;

    const created = this.searches.create({
      accountId,
      originCity,
      destinationCity,
      date,
      seats: input.seats ?? null,
      priceMax: input.priceMax ?? null,
      departureAfter: input.departureAfter ?? null,
      departureBefore: input.departureBefore ?? null,
      liveTracking: Boolean(input.liveTracking),
      comfortLevel: input.comfortLevel?.trim() || null,
      driverVerified: Boolean(input.driverVerified),
    });
    return this.searches.save(created);
  }

  async remove(accountId: string, id: string) {
    const entry = await this.searches.findOne({ where: { id, accountId } });
    if (!entry) return { ok: false };
    await this.searches.remove(entry);
    return { ok: true };
  }

  async findForRoute(originCity: string, destinationCity: string) {
    return this.searches
      .createQueryBuilder('s')
      .where('LOWER(s.originCity) = LOWER(:origin)', { origin: originCity })
      .andWhere('LOWER(s.destinationCity) = LOWER(:destination)', { destination: destinationCity })
      .getMany();
  }
}
