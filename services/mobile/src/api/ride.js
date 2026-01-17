import { CONFIG } from '../config';

export async function getRide(rideId) {
  const response = await fetch(`${CONFIG.rideUrl}/rides/${rideId}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'ride_fetch_failed');
  }
  return response.json();
}
