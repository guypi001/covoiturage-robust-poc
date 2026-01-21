import type { SearchRequest, SearchResponse } from '../api';

const rideSearchCache = new Map<string, SearchResponse>();

export function buildRideSearchKey(params: SearchRequest) {
  return JSON.stringify({
    from: params.from,
    to: params.to,
    date: params.date ?? null,
    seats: params.seats ?? null,
    priceMax: params.priceMax ?? null,
    departureAfter: params.departureAfter ?? null,
    departureBefore: params.departureBefore ?? null,
    sort: params.sort ?? 'soonest',
    liveTracking: params.liveTracking ?? null,
    comfortLevel: params.comfortLevel ?? null,
    driverVerified: params.driverVerified ?? null,
    emailVerified: params.emailVerified ?? null,
    phoneVerified: params.phoneVerified ?? null,
  });
}

export function getRideSearchCache(key: string) {
  return rideSearchCache.get(key);
}

export function setRideSearchCache(key: string, response: SearchResponse) {
  rideSearchCache.set(key, response);
}

export function clearRideSearchCache() {
  rideSearchCache.clear();
}
