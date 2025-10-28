import axios, { AxiosHeaders } from 'axios';
import type { LocationMeta } from './types/location';

const SEARCH_URL  = import.meta.env.VITE_SEARCH_URL  || 'http://localhost:3003';
const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'http://localhost:3004';
const RIDE_URL    = import.meta.env.VITE_RIDE_URL    || 'http://localhost:3002';
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || 'http://localhost:3000';
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:3000';
const MESSAGING_URL = import.meta.env.VITE_MESSAGING_URL || 'http://localhost:3012';

const api = axios.create();

let authToken: string | undefined;
let unauthorizedHandler: (() => void) | undefined;

export function setApiAuthToken(token?: string) {
  authToken = token || undefined;
}

export function clearApiAuthToken() {
  authToken = undefined;
}

export function registerUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  if (!config.headers) {
    config.headers = {};
  }
  const headers = config.headers;
  const hasAuthHeader =
    (headers as any).Authorization !== undefined ||
    (headers as any).authorization !== undefined ||
    (headers instanceof AxiosHeaders && headers.has('Authorization'));

  if (authToken && !hasAuthHeader) {
    if (headers instanceof AxiosHeaders) {
      headers.set('Authorization', `Bearer ${authToken}`);
    } else {
      (headers as any).Authorization = `Bearer ${authToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

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

export type ConversationSummary = {
  id: string;
  otherParticipant: {
    id: string;
    type: AccountType;
    label?: string | null;
  };
  lastMessageAt?: string;
  lastMessagePreview?: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: AccountType;
  senderLabel?: string | null;
  recipientId: string;
  recipientType: AccountType;
  recipientLabel?: string | null;
  body: string;
  status: 'DELIVERED' | 'READ';
  readAt?: string | null;
  deliveredAt: string;
  createdAt: string;
};

export type MessageNotificationSummary = {
  unreadConversations: number;
  unreadMessages: number;
  items: Array<{
    id: string;
    conversationId: string;
    messageId: string;
    preview: string | null;
    createdAt: string;
    sender?: {
      id: string;
      type: AccountType;
      label?: string | null;
    } | null;
  }>;
};

export type SearchRequest = {
  from: string;
  to: string;
  date?: string;
  seats?: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  sort?: 'soonest' | 'cheapest' | 'seats';
  fromMeta?: LocationMeta;
  toMeta?: LocationMeta;
};

export async function searchRides(params: SearchRequest) {
  const { from, to, date, seats, priceMax, departureAfter, departureBefore, sort } = params;
  const search = new URLSearchParams({
    from,
    to,
  });
  if (date) search.set('date', date);
  if (typeof seats === 'number') search.set('seats', String(seats));
  if (typeof priceMax === 'number' && priceMax > 0) search.set('priceMax', String(Math.floor(priceMax)));
  if (departureAfter) search.set('departureAfter', departureAfter);
  if (departureBefore) search.set('departureBefore', departureBefore);
  if (sort) search.set('sort', sort);
  const url = `${SEARCH_URL}/search?${search.toString()}`;
  const { data } = await api.get<Ride[]>(url, { withCredentials: false });
  return data;
}

export async function getRide(rideId: string) {
  const { data } = await api.get(`${RIDE_URL}/rides/${rideId}`);
  return data;
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>(`${MESSAGING_URL}/conversations`, {
    params: { userId },
  });
  return data;
}

export async function fetchConversationMessages(conversationId: string, userId: string, limit = 100) {
  const { data } = await api.get<ChatMessage[]>(
    `${MESSAGING_URL}/conversations/${conversationId}/messages`,
    { params: { userId, limit } },
  );
  return data;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { data } = await api.post<{ ok: boolean; unreadConversations: number }>(
    `${MESSAGING_URL}/conversations/${conversationId}/read`,
    { userId },
  );
  return data;
}

export type SendChatMessagePayload = {
  senderId: string;
  senderType: AccountType;
  senderLabel?: string;
  recipientId: string;
  recipientType: AccountType;
  recipientLabel?: string;
  body: string;
};

export async function sendChatMessage(payload: SendChatMessagePayload) {
  const { data } = await api.post<{ message: ChatMessage; conversation: ConversationSummary }>(
    `${MESSAGING_URL}/messages`,
    payload,
  );
  return data;
}

export async function getMessageNotifications(userId: string): Promise<MessageNotificationSummary> {
  const { data } = await api.get<MessageNotificationSummary>(`${MESSAGING_URL}/notifications`, {
    params: { userId },
  });
  return data;
}

export async function createBooking(payload: { rideId: string; passengerId: string; seats: number }) {
  const { data } = await api.post(`${BOOKING_URL}/bookings`, payload);
  return data; // { id, holdId?, amount, status, ... }
}

export async function captureBookingPayment(payload: { bookingId: string; amount: number; holdId?: string }) {
  const { data } = await api.post(`${PAYMENT_URL}/payments/capture`, payload);
  return data;
}

export type AccountType = 'INDIVIDUAL' | 'COMPANY';
export type AccountRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type FavoriteRoute = { from: string; to: string };
export type HomePreferences = {
  favoriteRoutes?: FavoriteRoute[];
  quickActions?: string[];
  theme?: 'default' | 'sunset' | 'night';
  heroMessage?: string;
  showTips?: boolean;
};

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
  role: AccountRole;
  status: AccountStatus;
  lastLoginAt?: string | null;
  loginCount: number;
  profilePhotoUrl?: string | null;
  homePreferences?: HomePreferences | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  token: string;
  account: Account;
};

export type AccountListStats = {
  byStatus: Record<AccountStatus, number>;
  byRole: Record<AccountRole, number>;
};

export type AccountListResponse = {
  data: Account[];
  total: number;
  offset: number;
  limit: number;
  filters: {
    status: AccountStatus | null;
    type: AccountType | null;
    search: string | null;
  };
  stats: AccountListStats;
};

export type HomePreferencesPayload = {
  favoriteRoutes?: FavoriteRoute[];
  quickActions?: string[];
  theme?: 'default' | 'sunset' | 'night';
  heroMessage?: string;
  showTips?: boolean;
};

export type RideAdminItem = {
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

export type RideAdminSummary = {
  upcoming: number;
  published: number;
  seatsBooked: number;
  seatsTotal: number;
};

export type BookingAdminItem = {
  id: string;
  rideId: string;
  passengerId: string;
  seats: number;
  amount: number;
  holdId: string | null;
  status: string;
  createdAt: string;
};

export type BookingAdminSummary = {
  byStatus: Record<string, number>;
  amountTotal: number;
  seatsTotal: number;
};

export type AdminActivityMetrics = {
  rides: {
    upcoming: number;
    past: number;
    seatsPublished: number;
    seatsReserved: number;
  };
  bookings: {
    totalSeats: number;
    totalAmount: number;
    byStatus: Record<string, number>;
  };
};

export type AdminAccountActivity = {
  account: Account;
  rides: {
    total: number;
    items: RideAdminItem[];
    summary: RideAdminSummary;
  };
  bookings: {
    total: number;
    items: BookingAdminItem[];
    summary: BookingAdminSummary;
  };
  metrics: AdminActivityMetrics;
};

export async function registerIndividualAccount(payload: {
  email: string;
  password: string;
  fullName: string;
  comfortPreferences?: string[];
  tagline?: string;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(`${IDENTITY_URL}/auth/register/individual`, payload);
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
  const { data } = await api.post<AuthResponse>(`${IDENTITY_URL}/auth/register/company`, payload);
  return data;
}

export async function loginAccount(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(`${IDENTITY_URL}/auth/login`, payload);
  return data;
}

export async function adminListAccounts(
  token: string,
  params: {
    status?: AccountStatus;
    type?: AccountType;
    search?: string;
    offset?: number;
    limit?: number;
  } = {},
): Promise<AccountListResponse> {
  const { data } = await api.get<AccountListResponse>(`${IDENTITY_URL}/admin/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

export async function adminUpdateAccountStatus(
  token: string,
  accountId: string,
  status: AccountStatus,
): Promise<Account> {
  const { data } = await api.patch<Account>(
    `${IDENTITY_URL}/admin/accounts/${accountId}/status`,
    { status },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function adminUpdateAccountRole(
  token: string,
  accountId: string,
  role: AccountRole,
): Promise<Account> {
  const { data } = await api.patch<Account>(
    `${IDENTITY_URL}/admin/accounts/${accountId}/role`,
    { role },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function adminUpdateAccountProfile(
  token: string,
  accountId: string,
  payload: {
    comfortPreferences?: string[];
    fullName?: string;
    companyName?: string;
    registrationNumber?: string;
    contactName?: string;
    contactPhone?: string;
    tagline?: string;
    removeTagline?: boolean;
    profilePhotoUrl?: string;
    removeProfilePhoto?: boolean;
    homePreferences?: HomePreferencesPayload;
  },
): Promise<Account> {
  const { data } = await api.patch<Account>(
    `${IDENTITY_URL}/admin/accounts/${accountId}/profile`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

export async function adminGetAccountActivity(
  token: string,
  accountId: string,
): Promise<AdminAccountActivity> {
  const { data } = await api.get<AdminAccountActivity>(
    `${IDENTITY_URL}/admin/accounts/${accountId}/activity`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

export async function requestGmailOtp(payload: { email: string }) {
  const { data } = await api.post(`${IDENTITY_URL}/auth/gmail/request`, payload);
  return data;
}

export async function verifyGmailOtp(payload: { email: string; code: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(`${IDENTITY_URL}/auth/gmail/verify`, payload);
  return data;
}

export async function getMyProfile(token: string): Promise<Account> {
  const { data } = await api.get<Account>(`${IDENTITY_URL}/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function getPublicProfile(accountId: string, token: string): Promise<Account> {
  const { data } = await api.get<Account>(`${IDENTITY_URL}/profiles/${accountId}/public`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function lookupAccountByEmail(email: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const { data } = await api.get<{ id: string; email: string; type: AccountType; fullName?: string | null; companyName?: string | null }>(
    `${IDENTITY_URL}/profiles/lookup`,
    {
      params: { email },
      headers,
    },
  );
  return data;
}

export async function updateIndividualProfile(
  token: string,
  payload: {
    comfortPreferences?: string[];
    tagline?: string;
    removeTagline?: boolean;
    profilePhotoUrl?: string;
    removeProfilePhoto?: boolean;
    homePreferences?: HomePreferencesPayload;
  },
): Promise<Account> {
  const { data } = await api.patch<Account>(`${IDENTITY_URL}/profiles/me/individual`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateCompanyProfile(
  token: string,
  payload: {
    companyName?: string;
    registrationNumber?: string;
    contactName?: string;
    contactPhone?: string;
    tagline?: string;
    removeTagline?: boolean;
    profilePhotoUrl?: string;
    removeProfilePhoto?: boolean;
    homePreferences?: HomePreferencesPayload;
  },
): Promise<Account> {
  const { data } = await api.patch<Account>(`${IDENTITY_URL}/profiles/me/company`, payload, {
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
