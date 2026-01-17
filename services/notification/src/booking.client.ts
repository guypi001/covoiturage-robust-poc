import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export type BookingSummary = {
  id: string;
  passengerId: string;
  rideId: string;
  seats?: number;
  amount?: number;
  status?: string;
  createdAt?: string;
};

@Injectable()
export class BookingClient {
  private readonly logger = new Logger(BookingClient.name);
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = process.env.BOOKING_URL || 'http://booking:3000';
    const timeout = Number(process.env.INTERNAL_HTTP_TIMEOUT || 2000);
    this.client = axios.create({ baseURL, timeout });
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
}
