import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export type AccountSummary = {
  id: string;
  email: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  fullName?: string | null;
  companyName?: string | null;
};

@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);
  private readonly apiKey?: string;
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = process.env.IDENTITY_INTERNAL_URL || 'http://identity:3000';
    const timeout = Number(process.env.INTERNAL_HTTP_TIMEOUT || 2000);
    this.apiKey = process.env.INTERNAL_API_KEY;
    this.client = axios.create({ baseURL, timeout });
  }

  async getAccountById(id: string): Promise<AccountSummary | null> {
    if (!this.apiKey) {
      this.logger.warn('INTERNAL_API_KEY missing. Identity lookups disabled.');
      return null;
    }

    try {
      const { data } = await this.client.get<AccountSummary>(`/internal/accounts/${id}`, {
        headers: { 'x-internal-api-key': this.apiKey },
      });
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        this.logger.warn(`Account ${id} not found during identity lookup.`);
      } else {
        this.logger.error(`Identity lookup failed for ${id}: ${err?.message || err}`);
      }
      return null;
    }
  }
}
