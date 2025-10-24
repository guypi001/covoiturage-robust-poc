import axios from 'axios';

const SEARCH_URL  = import.meta.env.VITE_SEARCH_URL  || 'http://localhost:3003';
const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:3004';
const RIDE_URL    = import.meta.env.VITE_RIDE_URL    || 'http://localhost:3002';
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || 'http://localhost:3000';
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:3000';

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

export async function searchRides(params: {from: string; to: string; date?: string; seats?: number}) {
  const { from, to, date, seats } = params;
  const search = new URLSearchParams({
    from,
    to,
  });
  if (date) search.set('date', date);
  if (typeof seats === 'number') search.set('seats', String(seats));
  const url = `${SEARCH_URL}/search?${search.toString()}`;
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

export async function captureBookingPayment(payload: { bookingId: string; amount: number; holdId?: string }) {
  const { data } = await axios.post(`${PAYMENT_URL}/payments/capture`, payload);
  return data;
}

export type AccountType = 'INDIVIDUAL' | 'COMPANY';

export type Account = {
  id: string;
  email: string;
  type: AccountType;
  fullName?: string | null;
  companyName?: string | null;
  registrationNumber?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  comfortPreferences?: string[] | null;
  tagline?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  token: string;
  account: Account;
};

export async function registerIndividualAccount(payload: {
  email: string;
  password: string;
  fullName: string;
  comfortPreferences?: string[];
  tagline?: string;
}): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${IDENTITY_URL}/auth/register/individual`, payload);
  return data;
}

export async function registerCompanyAccount(payload: {
  email: string;
  password: string;
  companyName: string;
  registrationNumber?: string;
  contactName?: string;
  contactPhone?: string;
}): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${IDENTITY_URL}/auth/register/company`, payload);
  return data;
}

export async function loginAccount(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${IDENTITY_URL}/auth/login`, payload);
  return data;
}

export async function requestGmailOtp(payload: { email: string }) {
  const { data } = await axios.post(`${IDENTITY_URL}/auth/gmail/request`, payload);
  return data;
}

export async function verifyGmailOtp(payload: { email: string; code: string }): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${IDENTITY_URL}/auth/gmail/verify`, payload);
  return data;
}

export async function getMyProfile(token: string): Promise<Account> {
  const { data } = await axios.get<Account>(`${IDENTITY_URL}/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateIndividualProfile(
  token: string,
  payload: { comfortPreferences?: string[]; tagline?: string },
): Promise<Account> {
  const { data } = await axios.patch<Account>(`${IDENTITY_URL}/profiles/me/individual`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateCompanyProfile(
  token: string,
  payload: { companyName?: string; registrationNumber?: string; contactName?: string; contactPhone?: string },
): Promise<Account> {
  const { data } = await axios.patch<Account>(`${IDENTITY_URL}/profiles/me/company`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
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
