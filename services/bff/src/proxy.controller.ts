import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import axios from 'axios';
import { upstreamDurationHistogram, upstreamRequestCounter } from './metrics';
const RIDE = process.env.RIDE_URL || 'http://ride:3002';
const SEARCH = process.env.SEARCH_URL || 'http://search:3003';
const BOOKING = process.env.BOOKING_URL || 'http://booking:3004';
const PAYMENT = process.env.PAYMENT_URL || 'http://payment:3005';
const IDENTITY = process.env.IDENTITY_URL || 'http://identity:3000';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'super-internal-key';

type RideAdminItem = {
  id: string;
  driverId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number;
  status: string;
  createdAt: string;
};

type BookingAdminItem = {
  id: string;
  rideId: string;
  passengerId: string;
  seats: number;
  amount: number;
  holdId: string | null;
  status: string;
  createdAt: string;
};
@Controller()
export class ProxyController {
  @Post('rides')
  async createRide(@Body() body: any) {
    return this.forward(() => axios.post(`${RIDE}/rides`, body), 'ride');
  }

  @Get('search')
  async search(@Query() q: any) {
    return this.forward(() => axios.get(`${SEARCH}/search`, { params: q }), 'search');
  }

  @Post('bookings')
  async booking(@Body() body: any) {
    return this.forward(() => axios.post(`${BOOKING}/bookings`, body), 'booking');
  }

  @Post('payments/capture')
  async capture(@Body() body: { bookingId: string; amount: number; holdId?: string }) {
    return this.forward(() => axios.post(`${PAYMENT}/mock-capture`, body), 'payment');
  }

  @Post('auth/register/individual')
  async registerIndividual(@Body() body: any) {
    return this.forward(() => axios.post(`${IDENTITY}/auth/register/individual`, body), 'identity');
  }

  @Post('auth/register/company')
  async registerCompany(@Body() body: any) {
    return this.forward(() => axios.post(`${IDENTITY}/auth/register/company`, body), 'identity');
  }

  @Post('auth/login')
  async login(@Body() body: any) {
    return this.forward(() => axios.post(`${IDENTITY}/auth/login`, body), 'identity');
  }

  @Post('auth/gmail/request')
  async gmailRequest(@Body() body: any) {
    return this.forward(() => axios.post(`${IDENTITY}/auth/gmail/request`, body), 'identity');
  }

  @Post('auth/gmail/verify')
  async gmailVerify(@Body() body: any) {
    return this.forward(() => axios.post(`${IDENTITY}/auth/gmail/verify`, body), 'identity');
  }

  @Get('profiles/me')
  async getProfile(@Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.get(`${IDENTITY}/profiles/me`, {
          headers,
        }),
      'identity',
    );
  }

  @Patch('profiles/me/individual')
  async updateIndividual(@Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.patch(`${IDENTITY}/profiles/me/individual`, body, {
          headers,
        }),
      'identity',
    );
  }

  @Patch('profiles/me/company')
  async updateCompany(@Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.patch(`${IDENTITY}/profiles/me/company`, body, {
          headers,
        }),
      'identity',
    );
  }

  @Get('profiles/lookup')
  async lookupProfile(@Query('email') email: string, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.get(`${IDENTITY}/profiles/lookup`, {
          params: { email },
          headers,
        }),
      'identity',
    );
  }

  @Get('profiles/:id/public')
  async publicProfile(@Param('id') id: string, @Req() req: any) {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id ?? '')) {
      throw new NotFoundException('account_not_found');
    }
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.get(`${IDENTITY}/profiles/${id}/public`, {
          headers,
        }),
      'identity',
    );
  }

  @Get('admin/accounts')
  async adminListAccounts(@Query() query: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.get(`${IDENTITY}/admin/accounts`, {
          params: query,
          headers,
        }),
      'identity',
    );
  }

  @Get('admin/accounts/:id')
  async adminGetAccount(@Param('id') id: string, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.get(`${IDENTITY}/admin/accounts/${id}`, {
          headers,
        }),
      'identity',
    );
  }

  @Patch('admin/accounts/:id/status')
  async adminUpdateStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.patch(`${IDENTITY}/admin/accounts/${id}/status`, body, {
          headers,
        }),
      'identity',
    );
  }

  @Patch('admin/accounts/:id/role')
  async adminUpdateRole(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.patch(`${IDENTITY}/admin/accounts/${id}/role`, body, {
          headers,
        }),
      'identity',
    );
  }

  @Patch('admin/accounts/:id/profile')
  async adminUpdateProfile(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return this.forward(
      () =>
        axios.patch(`${IDENTITY}/admin/accounts/${id}/profile`, body, {
          headers,
        }),
      'identity',
    );
  }

  @Get('admin/accounts/:id/activity')
  async adminAccountActivity(@Param('id') id: string, @Req() req: any) {
    const authHeaders = this.extractAuthHeaders(req);
    const account = await this.forward(
      () =>
        axios.get(`${IDENTITY}/admin/accounts/${id}`, {
          headers: authHeaders,
        }),
      'identity',
    );

    const internalHeaders = this.internalHeaders();

    const [ridesRes, bookingsRes] = await Promise.allSettled([
      this.forward(
        () =>
          axios.get<{ data: RideAdminItem[]; total: number; summary: any }>(`${RIDE}/admin/rides`, {
            params: { driverId: id, limit: 100 },
            headers: internalHeaders,
          }),
        'ride',
      ),
      this.forward(
        () =>
          axios.get<{ data: BookingAdminItem[]; total: number; summary: any }>(
            `${BOOKING}/admin/bookings`,
            {
              params: { passengerId: id, limit: 100 },
              headers: internalHeaders,
            },
          ),
        'booking',
      ),
    ]);

    const ridesPayload =
      ridesRes.status === 'fulfilled'
        ? ridesRes.value
        : {
            data: [] as RideAdminItem[],
            total: 0,
            summary: { upcoming: 0, published: 0, seatsBooked: 0, seatsTotal: 0 },
          };
    const bookingsPayload =
      bookingsRes.status === 'fulfilled'
        ? bookingsRes.value
        : {
            data: [] as BookingAdminItem[],
            total: 0,
            summary: { byStatus: {}, amountTotal: 0, seatsTotal: 0 },
          };

    const rides = Array.isArray(ridesPayload?.data) ? ridesPayload.data : [];
    const rideSummaryRaw = ridesPayload?.summary ?? {};
    const rideSummary = {
      upcoming: Number(rideSummaryRaw?.upcoming ?? 0),
      published: Number(rideSummaryRaw?.published ?? 0),
      seatsBooked: Number(rideSummaryRaw?.seatsBooked ?? 0),
      seatsTotal: Number(rideSummaryRaw?.seatsTotal ?? 0),
    };
    const rideTotal = Number(ridesPayload?.total ?? rides.length);

    const bookings = Array.isArray(bookingsPayload?.data) ? bookingsPayload.data : [];
    const bookingSummaryRaw = bookingsPayload?.summary ?? {};
    const bookingSummary = {
      byStatus: bookingSummaryRaw?.byStatus ?? {},
      amountTotal: Number(bookingSummaryRaw?.amountTotal ?? 0),
      seatsTotal: Number(bookingSummaryRaw?.seatsTotal ?? 0),
    };
    const bookingTotal = Number(bookingsPayload?.total ?? bookings.length);

    const derivedMetrics = this.computeActivityMetrics(rides, bookings);

    return {
      account,
      rides: {
        total: rideTotal,
        items: rides,
        summary: rideSummary,
      },
      bookings: {
        total: bookingTotal,
        items: bookings,
        summary: bookingSummary,
      },
      metrics: derivedMetrics,
    };
  }

  private async forward<T>(call: () => Promise<{ data: T }>, target: string): Promise<T> {
    const end = upstreamDurationHistogram.startTimer({ target });
    try {
      const res = await call();
      upstreamRequestCounter.inc({ target, outcome: 'success' });
      end();
      return res.data;
    } catch (err: any) {
      end();
      let outcome = 'error';
      if (axios.isAxiosError(err) && err.response?.status) {
        const status = err.response.status;
        if (status >= 500) outcome = '5xx';
        else if (status >= 400) outcome = '4xx';
        else outcome = String(status);
      }
      upstreamRequestCounter.inc({ target, outcome });
      if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? 502;
        const payload = err.response?.data ?? {
          error: 'proxy_error',
          message: err.message,
        };
        throw new HttpException(payload, status);
      }
      throw new InternalServerErrorException('proxy_failure');
    }
  }

  private extractAuthHeaders(req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return headers;
  }

  private internalHeaders() {
    return { 'x-internal-key': INTERNAL_KEY };
  }

  private computeActivityMetrics(rides: any[], bookings: any[]) {
    const now = Date.now();

    const ridesUpcoming = rides.filter((ride) => {
      const ts = Date.parse(ride?.departureAt ?? '');
      return Number.isFinite(ts) && ts > now;
    }).length;
    const ridesPast = rides.filter((ride) => {
      const ts = Date.parse(ride?.departureAt ?? '');
      return Number.isFinite(ts) && ts <= now;
    }).length;
    const seatsPublished = rides.reduce((acc, ride) => acc + (ride?.seatsTotal ?? 0), 0);
    const seatsReserved = rides.reduce(
      (acc, ride) => acc + ((ride?.seatsTotal ?? 0) - (ride?.seatsAvailable ?? 0)),
      0,
    );

    const bookingAmount = bookings.reduce((acc, booking) => acc + (booking?.amount ?? 0), 0);
    const bookingSeats = bookings.reduce((acc, booking) => acc + (booking?.seats ?? 0), 0);
    const bookingStatusCount = bookings.reduce<Record<string, number>>((acc, booking) => {
      const status = booking?.status ?? 'UNKNOWN';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      rides: {
        upcoming: ridesUpcoming,
        past: ridesPast,
        seatsPublished,
        seatsReserved,
      },
      bookings: {
        totalSeats: bookingSeats,
        totalAmount: bookingAmount,
        byStatus: bookingStatusCount,
      },
    };
  }
}
