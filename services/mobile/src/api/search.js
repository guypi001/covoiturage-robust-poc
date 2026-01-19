import { apiFetch } from './http';
import { CONFIG } from '../config';

export async function searchRides(params) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.date) search.set('date', params.date);
  if (params.seats) search.set('seats', String(params.seats));
  if (params.priceMax) search.set('priceMax', String(params.priceMax));
  if (params.departureAfter) search.set('departureAfter', params.departureAfter);
  if (params.departureBefore) search.set('departureBefore', params.departureBefore);
  if (params.sort) search.set('sort', params.sort);
  if (typeof params.liveTracking === 'boolean') {
    search.set('liveTracking', params.liveTracking ? 'true' : 'false');
  }
  return apiFetch(`${CONFIG.searchUrl}/search?${search.toString()}`);
}
