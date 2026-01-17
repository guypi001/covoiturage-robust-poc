import type { Ride, SearchRequest } from '../api';

const rideSearchCache = new Map<string, Ride[]>();

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
  });
}

export function getRideSearchCache(key: string) {
  return rideSearchCache.get(key);
}

export function setRideSearchCache(key: string, rides: Ride[]) {
  rideSearchCache.set(key, rides);
}

export function clearRideSearchCache() {
  rideSearchCache.clear();
}
