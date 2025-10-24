import { Controller, Get, Post, Patch, Body, Query, Req, Param, NotFoundException } from '@nestjs/common';
import axios from 'axios';
const RIDE = process.env.RIDE_URL || 'http://ride:3002';
const SEARCH = process.env.SEARCH_URL || 'http://search:3003';
const BOOKING = process.env.BOOKING_URL || 'http://booking:3004';
const PAYMENT = process.env.PAYMENT_URL || 'http://payment:3005';
const IDENTITY = process.env.IDENTITY_URL || 'http://identity:3000';
@Controller()
export class ProxyController {
  @Post('rides')
  async createRide(@Body() body: any) {
    return (await axios.post(`${RIDE}/rides`, body)).data;
  }

  @Get('search')
  async search(@Query() q: any) {
    return (await axios.get(`${SEARCH}/search`, { params: q })).data;
  }

  @Post('bookings')
  async booking(@Body() body: any) {
    return (await axios.post(`${BOOKING}/bookings`, body)).data;
  }

  @Post('payments/capture')
  async capture(@Body() body: { bookingId: string; amount: number; holdId?: string }) {
    return (await axios.post(`${PAYMENT}/mock-capture`, body)).data;
  }

  @Post('auth/register/individual')
  async registerIndividual(@Body() body: any) {
    return (await axios.post(`${IDENTITY}/auth/register/individual`, body)).data;
  }

  @Post('auth/register/company')
  async registerCompany(@Body() body: any) {
    return (await axios.post(`${IDENTITY}/auth/register/company`, body)).data;
  }

  @Post('auth/login')
  async login(@Body() body: any) {
    return (await axios.post(`${IDENTITY}/auth/login`, body)).data;
  }

  @Post('auth/gmail/request')
  async gmailRequest(@Body() body: any) {
    return (await axios.post(`${IDENTITY}/auth/gmail/request`, body)).data;
  }

  @Post('auth/gmail/verify')
  async gmailVerify(@Body() body: any) {
    return (await axios.post(`${IDENTITY}/auth/gmail/verify`, body)).data;
  }

  @Get('profiles/me')
  async getProfile(@Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return (
      await axios.get(`${IDENTITY}/profiles/me`, {
        headers,
      })
    ).data;
  }

  @Patch('profiles/me/individual')
  async updateIndividual(@Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return (
      await axios.patch(`${IDENTITY}/profiles/me/individual`, body, {
        headers,
      })
    ).data;
  }

  @Patch('profiles/me/company')
  async updateCompany(@Body() body: any, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return (
      await axios.patch(`${IDENTITY}/profiles/me/company`, body, {
        headers,
      })
    ).data;
  }

  @Get('profiles/lookup')
  async lookupProfile(@Query('email') email: string, @Req() req: any) {
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return (
      await axios.get(`${IDENTITY}/profiles/lookup`, {
        params: { email },
        headers,
      })
    ).data;
  }

  @Get('profiles/:id/public')
  async publicProfile(@Param('id') id: string, @Req() req: any) {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id ?? '')) {
      throw new NotFoundException('account_not_found');
    }
    const headers: Record<string, string> = {};
    if (req.headers?.authorization) headers['authorization'] = req.headers.authorization;
    return (
      await axios.get(`${IDENTITY}/profiles/${id}/public`, {
        headers,
      })
    ).data;
  }
}
