import axios from 'axios';

const SEARCH_URL  = import.meta.env.VITE_SEARCH_URL  || 'http://localhost:3003';
const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:3004';
const RIDE_URL    = import.meta.env.VITE_RIDE_URL    || 'http://localhost:3002';

export type Ride = {
  rideId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsTotal: number;
  seatsAvailable: number;
  driverId: string;
  status: 'PUBLISHED'|'CLOSED';
};

export async function searchRides(params: {from: string; to: string; date?: string}) {
  const { from, to, date } = params;
  const url = `${SEARCH_URL}/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${date ? `&date=${encodeURIComponent(date)}` : ''}`;
  const { data } = await axios.get<Ride[]>(url, { withCredentials: false });
  return data;
}

export async function getRide(rideId: string) {
  const { data } = await axios.get(`${RIDE_URL}/rides/${rideId}`);
  return data;
}

export async function createBooking(payload: { rideId: string; passengerId: string; seats: number }) {
  const { data } = await axios.post(`${BOOKING_URL}/bookings`, payload);
  return data; // { id, holdId?, amount, status, ... }
}

// --- Types pour la création d’un trajet ---
export type CreateRidePayload = {
  originCity: string;
  destinationCity: string;
  departureAt: string;   // ISO string (ex: 2025-11-02T08:00:00Z)
  pricePerSeat: number;
  seatsTotal: number;
  driverId: string;      // pour le PoC tu peux mettre "drv-seed"
};

// --- Appel au service ride ---
export async function createRide(payload: CreateRidePayload) {
  const base = import.meta.env.VITE_RIDE_URL || 'http://localhost:3002';
  const res = await fetch(`${base}/rides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `createRide failed (${res.status})`);
  }
  return res.json();
}
