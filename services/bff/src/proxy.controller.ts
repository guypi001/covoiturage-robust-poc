import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import axios from 'axios';
const RIDE = process.env.RIDE_URL || 'http://ride:3002';
const SEARCH = process.env.SEARCH_URL || 'http://search:3003';
const BOOKING = process.env.BOOKING_URL || 'http://booking:3004';
@Controller() export class ProxyController {
  @Post('rides') async createRide(@Body() body:any){ return (await axios.post(`${RIDE}/rides`, body)).data; }
  @Get('search') async search(@Query() q:any){ return (await axios.get(`${SEARCH}/search`, { params:q })).data; }
  @Post('bookings') async booking(@Body() body:any){ return (await axios.post(`${BOOKING}/bookings`, body)).data; }
}
