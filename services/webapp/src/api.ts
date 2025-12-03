import axios, { AxiosHeaders } from 'axios';
import type { LocationMeta } from './types/location';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const INTERNAL_HOSTNAMES = new Set([
  'bff',
  'identity',
  'ride',
  'booking',
  'search',
  'payment',
  'wallet',
  'payouts',
  'notification',
  'messaging',
  'config',
]);

function isLocalHostname(value: string | undefined | null) {
  if (!value) return false;
  if (LOCAL_HOSTNAMES.has(value)) return true;
  if (INTERNAL_HOSTNAMES.has(value)) return true;
  if (value.startsWith('127.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(value)) return true; // 172.16.0.0/12
  if (/^10\./.test(value)) return true; // 10.0.0.0/8
  if (/^192\.168\./.test(value)) return true; // 192.168.0.0/16
  return false;
}

function resolveServiceUrl(
  envValue: string | undefined,
  defaultPort: number,
  proxyPath?: string,
  forceProxy = false,
) {
  const fallback = `http://localhost${defaultPort ? `:${defaultPort}` : ''}`;
  const hasWindow = typeof window !== 'undefined' && typeof window.location !== 'undefined';
  const windowHost = hasWindow ? window.location.hostname : undefined;
  const windowOrigin = hasWindow ? `${window.location.protocol}//${window.location.host}` : undefined;
  const preferProxy =
    forceProxy ||
    Boolean(proxyPath && windowOrigin && windowHost && !isLocalHostname(windowHost));

  if (envValue) {
    try {
      const parsed = new URL(envValue);
      const envHostIsLocal = isLocalHostname(parsed.hostname);
      const effectivePort = parsed.port ? Number(parsed.port) : defaultPort;

      if (preferProxy && envHostIsLocal) {
        return `${windowOrigin}${proxyPath}`;
      }

      if (!envHostIsLocal) {
        return envValue;
      }

      if (hasWindow && windowHost) {
        const portSegment =
          effectivePort && effectivePort !== 80 && effectivePort !== 443
            ? `:${effectivePort}`
            : '';
        return `${window.location.protocol}//${windowHost}${portSegment}`;
      }

      return fallback;
    } catch {
      if (preferProxy) {
        return `${windowOrigin}${proxyPath}`;
      }
      return envValue;
    }
  }

  if (preferProxy) {
    return `${windowOrigin}${proxyPath}`;
  }

  if (hasWindow && windowHost) {
    const portSegment =
      defaultPort && defaultPort !== 80 && defaultPort !== 443 ? `:${defaultPort}` : '';
    return `${window.location.protocol}//${windowHost}${portSegment}`;
  }

  return fallback;
}

const SEARCH_URL = resolveServiceUrl(
  import.meta.env.VITE_SEARCH_URL,
  3003,
  '/api/search',
  true,
);
const BOOKING_URL = resolveServiceUrl(import.meta.env.VITE_BOOKING_URL, 3004, '/api/booking');
const RIDE_URL = resolveServiceUrl(import.meta.env.VITE_RIDE_URL, 3002, '/api/ride');
const PAYMENT_URL = resolveServiceUrl(import.meta.env.VITE_PAYMENT_URL, 3000, '/api/payment');
const IDENTITY_URL = resolveServiceUrl(import.meta.env.VITE_IDENTITY_URL, 3000, '/api/identity');
const MESSAGING_URL = resolveServiceUrl(
  import.meta.env.VITE_MESSAGING_URL,
  3012,
  '/api/messaging',
);
const BFF_URL = resolveServiceUrl(import.meta.env.VITE_BFF_URL, 3000, '/api/bff', true);

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
    config.headers = new AxiosHeaders();
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
  driverLabel?: string | null;
  pricePerSeat: number;
  seatsTotal: number;
  seatsAvailable: number;
  driverId: string;
  status: 'PUBLISHED'|'CLOSED';
  driverPhotoUrl?: string | null;
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

export async function searchRides(
  params: SearchRequest,
  options: { signal?: AbortSignal } = {},
) {
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
  let cancelSource: ReturnType<typeof axios.CancelToken.source> | undefined;
  let abortListener: (() => void) | undefined;
  if (options.signal) {
    cancelSource = axios.CancelToken.source();
    if (options.signal.aborted) {
      cancelSource.cancel('aborted');
    } else {
      abortListener = () => cancelSource?.cancel('aborted');
      options.signal.addEventListener('abort', abortListener);
    }
  }
  try {
    const { data } = await api.get<Ride[]>(url, {
      withCredentials: false,
      cancelToken: cancelSource?.token,
    });
    return data;
  } finally {
    if (options.signal && abortListener) {
      options.signal.removeEventListener('abort', abortListener);
    }
  }
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
  const { data } = await api.post(`${BFF_URL}/bookings`, payload);
  return data; // { id, holdId?, amount, status, ... }
}

export async function captureBookingPayment(payload: { bookingId: string; amount: number; holdId?: string }) {
  const { data } = await api.post(`${BFF_URL}/payments/capture`, payload);
  return data;
}

export async function fetchMyFleet(params?: {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get<FleetListResponse>('/companies/me/vehicles', {
    params,
  });
  return data;
}

export async function createFleetVehicle(payload: CreateFleetVehiclePayload) {
  const { data } = await api.post<FleetVehicle>('/companies/me/vehicles', payload);
  return data;
}

export async function updateFleetVehicle(vehicleId: string, payload: UpdateFleetVehiclePayload) {
  const { data } = await api.patch<FleetVehicle>(`/companies/me/vehicles/${vehicleId}`, payload);
  return data;
}

export async function archiveFleetVehicle(vehicleId: string) {
  const { data } = await api.delete<FleetVehicle>(`/companies/me/vehicles/${vehicleId}`);
  return data;
}

export async function listFleetSchedules(
  vehicleId: string,
  params?: { status?: FleetScheduleStatus | 'ALL'; window?: 'upcoming' | 'past' | 'all' },
) {
  const { data } = await api.get<{
    data: FleetSchedule[];
    total: number;
    offset: number;
    limit: number;
    summary: { planned: number; completed: number; cancelled: number };
  }>(`/companies/me/vehicles/${vehicleId}/schedules`, {
    params,
  });
  return data;
}

export async function createFleetSchedule(vehicleId: string, payload: CreateFleetSchedulePayload) {
  const { data } = await api.post<FleetSchedule>(
    `/companies/me/vehicles/${vehicleId}/schedules`,
    payload,
  );
  return data;
}

export async function updateFleetSchedule(
  vehicleId: string,
  scheduleId: string,
  payload: UpdateFleetSchedulePayload,
) {
  const { data } = await api.patch<FleetSchedule>(
    `/companies/me/vehicles/${vehicleId}/schedules/${scheduleId}`,
    payload,
  );
  return data;
}

export async function cancelFleetSchedule(vehicleId: string, scheduleId: string) {
  const { data } = await api.delete<FleetSchedule>(
    `/companies/me/vehicles/${vehicleId}/schedules/${scheduleId}`,
  );
  return data;
}

export async function adminFetchCompanyFleet(
  companyId: string,
  params?: { search?: string; status?: 'ACTIVE' | 'INACTIVE' | 'ALL' },
) {
  const { data } = await api.get<FleetListResponse>(`/admin/companies/${companyId}/vehicles`, {
    params,
  });
  return data;
}

export async function adminListCompanySchedules(
  companyId: string,
  vehicleId: string,
  params?: { status?: FleetScheduleStatus | 'ALL'; window?: 'upcoming' | 'past' | 'all' },
) {
  const { data } = await api.get<{
    data: FleetSchedule[];
    total: number;
    offset: number;
    limit: number;
    summary: { planned: number; completed: number; cancelled: number };
  }>(`/admin/companies/${companyId}/vehicles/${vehicleId}/schedules`, {
    params,
  });
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
  driverLabel?: string | null;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number;
  status: string;
  createdAt: string;
  reservations?: RideReservation[];
};

export type RideAdminSummary = {
  upcoming: number;
  published: number;
  seatsBooked: number;
  seatsTotal: number;
  averagePrice?: number;
  occupancyRate?: number;
  byStatus?: Record<string, number>;
  topRoutes?: Array<{ origin: string; destination: string; count: number }>;
};

export type RideReservation = {
  id: string;
  rideId: string;
  passengerId: string;
  seats: number;
  amount: number;
  status: string;
  passengerName?: string | null;
  passengerEmail?: string | null;
};

export type PaymentMethod = {
  id: string;
  type: 'CARD' | 'MOBILE_MONEY' | 'CASH';
  label?: string | null;
  provider?: string | null;
  last4?: string | null;
  expiresAt?: string | null;
  phoneNumber?: string | null;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUpdateRidePayload = {
  originCity?: string;
  destinationCity?: string;
  departureAt?: string;
  seatsTotal?: number;
  seatsAvailable?: number;
  pricePerSeat?: number;
  status?: 'PUBLISHED' | 'CLOSED';
};

export type AdminRideDigestPayload = {
  recipient: string;
  driverId?: string;
  origin?: string;
  destination?: string;
  departureAfter?: string;
  departureBefore?: string;
  status?: 'PUBLISHED' | 'CLOSED' | 'ALL';
  limit?: number;
  includeInsights?: boolean;
  attachCsv?: boolean;
  message?: string;
  targetScope?: 'ALL' | 'ACCOUNT_ONLY';
  includeUpcomingOnly?: boolean;
};

export type AdminRideDigestInsights = {
  nextDeparture?: RideAdminItem | null;
  averageSeats?: number;
  occupancyRate?: number;
  averagePrice?: number;
  topRoutes?: Array<{ origin: string; destination: string; count: number }>;
};

export type AdminRideDigestResponse = {
  delivered: boolean;
  summary: RideAdminSummary;
  insights?: AdminRideDigestInsights;
  count?: number;
  reason?: string;
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
  ride?: RideAdminItem | null;
};

export type BookingAdminSummary = {
  byStatus: Record<string, number>;
  amountTotal: number;
  seatsTotal: number;
};

export type FleetVehicleStatus = 'ACTIVE' | 'INACTIVE';
export type FleetScheduleStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';
export type FleetScheduleRecurrence = 'NONE' | 'DAILY' | 'WEEKLY';

export type FleetSchedule = {
  id: string;
  companyId: string;
  vehicleId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  arrivalEstimate?: string | null;
  plannedSeats: number;
  reservedSeats: number;
  pricePerSeat: number;
  recurrence: FleetScheduleRecurrence;
  status: FleetScheduleStatus;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetVehicle = {
  id: string;
  companyId: string;
  label: string;
  plateNumber: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  seats: number;
  year?: number | null;
  status: FleetVehicleStatus;
  amenities?: string[] | null;
  specs?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  metrics?: {
    upcomingTrips: number;
    nextDepartureAt?: string | null;
  };
  upcomingSchedules?: FleetSchedule[];
};

export type FleetSummary = {
  active: number;
  inactive: number;
  fleetSeats: number;
  upcomingTrips: number;
};

export type FleetListResponse = {
  data: FleetVehicle[];
  total: number;
  offset: number;
  limit: number;
  summary: FleetSummary;
};

export type CreateFleetVehiclePayload = {
  label: string;
  plateNumber: string;
  category: string;
  seats: number;
  brand?: string;
  model?: string;
  year?: number;
  amenities?: string[];
  specs?: Record<string, any>;
};

export type UpdateFleetVehiclePayload = Partial<CreateFleetVehiclePayload> & {
  status?: FleetVehicleStatus;
};

export type CreateFleetSchedulePayload = {
  originCity: string;
  destinationCity: string;
  departureAt: string;
  arrivalEstimate?: string;
  plannedSeats?: number;
  pricePerSeat?: number;
  recurrence?: FleetScheduleRecurrence;
  notes?: string;
  metadata?: Record<string, any>;
};

export type UpdateFleetSchedulePayload = Partial<CreateFleetSchedulePayload> & {
  status?: FleetScheduleStatus;
  reservedSeats?: number;
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

export type AdminRideListResponse = {
  data: RideAdminItem[];
  total: number;
  offset: number;
  limit: number;
  summary: RideAdminSummary;
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

export async function requestPasswordReset(payload: { email: string }) {
  const { data } = await api.post<{ success: boolean }>(`${IDENTITY_URL}/auth/password/forgot`, payload);
  return data;
}

export async function resetPassword(payload: { token: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(`${IDENTITY_URL}/auth/password/reset`, payload);
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

export async function adminUpdateRide(
  token: string,
  rideId: string,
  payload: AdminUpdateRidePayload,
): Promise<RideAdminItem> {
  const { data } = await api.patch<RideAdminItem>(
    `${IDENTITY_URL}/admin/rides/${rideId}`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

export async function adminCloseRide(token: string, rideId: string): Promise<RideAdminItem> {
  const { data } = await api.post<RideAdminItem>(
    `${IDENTITY_URL}/admin/rides/${rideId}/close`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

export async function adminShareRides(
  token: string,
  payload: AdminRideDigestPayload,
): Promise<AdminRideDigestResponse> {
  const { data } = await api.post<AdminRideDigestResponse>(
    `${IDENTITY_URL}/admin/rides/share`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

export async function adminListRides(
  token: string,
  params: Record<string, any>,
): Promise<AdminRideListResponse> {
  const { data } = await api.get<AdminRideListResponse>(`/admin/rides`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

export type MyBookingsResponse = {
  data: BookingAdminItem[];
  total: number;
  offset: number;
  limit: number;
  summary?: BookingAdminSummary;
};

export async function getMyBookings(
  token: string,
  params: { status?: string; limit?: number; offset?: number } = {},
): Promise<MyBookingsResponse> {
  const { data } = await api.get<MyBookingsResponse>(`${BFF_URL}/me/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

export async function getMyPublishedRides(
  token: string,
  params: { status?: string; limit?: number; offset?: number; sort?: string } = {},
): Promise<AdminRideListResponse> {
  const { data } = await api.get<AdminRideListResponse>(`${BFF_URL}/me/rides`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

export async function getMyPaymentMethods(token: string): Promise<PaymentMethod[]> {
  const { data } = await api.get<PaymentMethod[]>(`${BFF_URL}/me/payment-methods`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function addPaymentMethod(
  token: string,
  payload: {
    type: 'CARD' | 'MOBILE_MONEY' | 'CASH';
    label?: string;
    provider?: string;
    last4?: string;
    expiresAt?: string;
    phoneNumber?: string;
  },
): Promise<PaymentMethod> {
  const { data } = await api.post<PaymentMethod>(`${BFF_URL}/me/payment-methods`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function deletePaymentMethod(token: string, methodId: string) {
  const { data } = await api.delete<{ ok: boolean }>(`${BFF_URL}/me/payment-methods/${methodId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  const { data } = await api.get<Account>(`${BFF_URL}/me/profile`, {
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
    fullName?: string;
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
  seatsAvailable?: number;
  driverId?: string;
  driverLabel?: string | null;
  driverPhotoUrl?: string | null;
};

// --- Appel au service ride ---
export async function createRide(payload: CreateRidePayload) {
  const body = {
    ...payload,
    seatsAvailable: payload.seatsAvailable ?? payload.seatsTotal,
  };
  const { data } = await api.post(`${RIDE_URL}/rides`, body);
  return data;
}
