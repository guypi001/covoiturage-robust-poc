import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export type RideSummary = {
  id: string;
  originCity?: string;
  destinationCity?: string;
  departureAt?: string;
};

@Injectable()
export class RideClient {
  private readonly logger = new Logger(RideClient.name);
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = process.env.RIDE_URL || 'http://ride:3000';
    const timeout = Number(process.env.INTERNAL_HTTP_TIMEOUT || 2000);
    this.client = axios.create({ baseURL, timeout });
  }

  async getRide(id: string): Promise<RideSummary | null> {
    try {
      const { data } = await this.client.get<RideSummary | { error: string }>(`/rides/${id}`);
      if ((data as any)?.error) return null;
      return data as RideSummary;
    } catch (err: any) {
      this.logger.warn(`Ride lookup failed for ${id}: ${err?.message || err}`);
      return null;
    }
  }
}
