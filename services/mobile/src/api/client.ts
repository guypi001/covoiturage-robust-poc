import { API_CONFIG } from '../config';

export async function searchRides(params: {
  from: string;
  to: string;
  date?: string;
  seats?: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  sort?: 'soonest' | 'cheapest' | 'seats';
  liveTracking?: boolean;
}) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.date) search.set('date', params.date);
  if (typeof params.seats === 'number') search.set('seats', String(params.seats));
  if (typeof params.priceMax === 'number') search.set('priceMax', String(params.priceMax));
  if (params.departureAfter) search.set('departureAfter', params.departureAfter);
  if (params.departureBefore) search.set('departureBefore', params.departureBefore);
  if (params.sort) search.set('sort', params.sort);
  if (typeof params.liveTracking === 'boolean') {
    search.set('liveTracking', params.liveTracking ? 'true' : 'false');
  }

  const response = await fetch(`${API_CONFIG.searchUrl}/search?${search.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'search_failed');
  }
  return response.json();
}
