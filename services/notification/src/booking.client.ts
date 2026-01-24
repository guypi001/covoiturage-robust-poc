import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export type BookingSummary = {
  id: string;
  referenceCode?: string | null;
  passengerId: string;
  rideId: string;
  seats?: number;
  amount?: number;
  passengerName?: string | null;
  passengerEmail?: string | null;
  passengerPhone?: string | null;
  status?: string;
  createdAt?: string;
};

@Injectable()
export class BookingClient {
  private readonly logger = new Logger(BookingClient.name);
  private readonly client: AxiosInstance;
  private readonly internalKey?: string;

  constructor() {
    const baseURL = process.env.BOOKING_URL || 'http://booking:3000';
    const timeout = Number(process.env.INTERNAL_HTTP_TIMEOUT || 2000);
    this.client = axios.create({ baseURL, timeout });
    this.internalKey = process.env.INTERNAL_API_KEY;
  }

  async getBooking(id: string): Promise<BookingSummary | null> {
    try {
      const { data } = await this.client.get<BookingSummary | { error: string }>(`/bookings/${id}`);
      if ((data as any)?.error) return null;
      return data as BookingSummary;
    } catch (err: any) {
      this.logger.warn(`Booking lookup failed for ${id}: ${err?.message || err}`);
      return null;
    }
  }

  async listByRide(rideId: string): Promise<BookingSummary[]> {
    if (!this.internalKey) {
      this.logger.warn('INTERNAL_API_KEY missing. Booking admin lookup disabled.');
      return [];
    }
    try {
      const { data } = await this.client.get<{ data: BookingSummary[] }>(`/admin/bookings`, {
        params: { rideId, limit: 500 },
        headers: { 'x-internal-key': this.internalKey },
      });
      return data?.data ?? [];
    } catch (err: any) {
      this.logger.warn(`Booking list failed for ride ${rideId}: ${err?.message || err}`);
      return [];
    }
  }
}
