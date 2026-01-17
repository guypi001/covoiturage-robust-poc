import { create } from 'zustand';
import type { Ride, Account } from './api';
import {
  getMyProfile,
  getMessageNotifications,
  registerUnauthorizedHandler,
  setApiAuthToken,
  clearApiAuthToken,
} from './api';
import type { LocationMeta } from './types/location';

const TOKEN_KEY = 'kari_token';
const getStoredToken = () =>
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) ?? undefined : undefined;
const persistToken = (token?: string) => {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
};
const initialToken = getStoredToken();

type LastSearch = {
  from: string;
  to: string;
  date?: string;
  seats?: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  sort?: 'soonest' | 'cheapest' | 'seats';
  liveTracking?: boolean;
  fromMeta?: LocationMeta;
  toMeta?: LocationMeta;
};

export const buildSearchKey = (q?: LastSearch) => {
  if (!q) return undefined;
  const normalize = (value?: string) => value?.trim().toLowerCase() ?? '';
  return [
    normalize(q.from),
    normalize(q.to),
    q.date ?? '',
    q.seats ?? '',
    q.priceMax ?? '',
    q.departureAfter ?? '',
    q.departureBefore ?? '',
    q.sort ?? '',
    q.liveTracking ?? '',
  ].join('|');
};

type RideAvailability = {
  seatsAvailable: number;
  seatsTotal?: number;
  updatedAt: number;
};

type State = {
  lastSearch?: LastSearch;
  lastSearchKey?: string;
  results: Ride[];
  resultsQueryKey?: string;
  resultsUpdatedAt?: number;
  loading: boolean;
  error?: string;
  passengerId: string;
  token?: string;
  account?: Account;
  authLoading: boolean;
  authReady: boolean;
  authError?: string;
  messageBadge: number;
  savedRides: Record<string, SavedRide>;
  rideAvailability: Record<string, RideAvailability>;
};

type Actions = {
  setPassenger: (id: string) => void;
  setSearch: (q: LastSearch | undefined) => void;
  setResults: (r: Ride[], queryKey?: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e?: string) => void;
  setSession: (token: string, account: Account) => void;
  clearSession: () => void;
  initializeAuth: () => Promise<void>;
  refreshMessageBadge: () => Promise<void>;
  toggleSavedRide: (ride: SavedRide) => void;
  removeSavedRide: (rideId: string) => void;
  setRideAvailability: (rideId: string, seatsAvailable: number, seatsTotal?: number) => void;
};

export type SavedRide = {
  rideId: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsAvailable: number;
  driverLabel?: string | null;
};

const SAVED_KEY = 'kari_saved_rides';
const loadSavedRides = (): Record<string, SavedRide> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const persistSavedRides = (saved: Record<string, SavedRide>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // ignore
  }
};

export const useApp = create<State & Actions>((set, get) => ({
  results: [],
  loading: false,
  passengerId: 'usr-demo',
  token: initialToken,
  authLoading: false,
  authReady: initialToken ? false : true,
  messageBadge: 0,
  savedRides: loadSavedRides(),
  rideAvailability: {},
  setPassenger: (id) => set({ passengerId: id }),
  setSearch: (q) => set({ lastSearch: q, lastSearchKey: buildSearchKey(q) }),
  setResults: (r, queryKey) =>
    set({
      results: r,
      resultsUpdatedAt: queryKey ? Date.now() : undefined,
      resultsQueryKey: queryKey,
    }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setSession: (token, account) => {
    persistToken(token);
    setApiAuthToken(token);
    set({
      token,
      account,
      authLoading: false,
      authReady: true,
      authError: undefined,
      passengerId: account.id || 'usr-demo',
    });
    get().refreshMessageBadge();
  },
  clearSession: () => {
    persistToken(undefined);
    clearApiAuthToken();
    set({
      token: undefined,
      account: undefined,
      authReady: true,
      authLoading: false,
      authError: undefined,
      lastSearch: undefined,
      lastSearchKey: undefined,
      results: [],
      resultsQueryKey: undefined,
      resultsUpdatedAt: undefined,
      passengerId: 'usr-demo',
      messageBadge: 0,
    });
  },
  initializeAuth: async () => {
    const { authReady, authLoading } = get();
    if (authReady || authLoading) return;
    const token = get().token;
    if (!token) {
      clearApiAuthToken();
      set({ authReady: true, authLoading: false, authError: undefined });
      return;
    }
    try {
      set({ authLoading: true, authError: undefined });
      const account = await getMyProfile(token);
      setApiAuthToken(token);
      if (account.status && account.status !== 'ACTIVE') {
        persistToken(undefined);
        clearApiAuthToken();
        set({
          token: undefined,
          account: undefined,
          authReady: true,
          authLoading: false,
          authError: 'Compte suspendu. Contacte le support.',
          passengerId: 'usr-demo',
        });
        return;
      }
      set({
        account,
        authReady: true,
        authLoading: false,
        authError: undefined,
        passengerId: account.id || 'usr-demo',
      });
      await get().refreshMessageBadge();
    } catch (e: any) {
      persistToken(undefined);
      clearApiAuthToken();
      set({
        token: undefined,
        account: undefined,
        authReady: true,
        authLoading: false,
        authError: e?.message || 'Session invalide',
      });
    }
  },
  refreshMessageBadge: async () => {
    const account = get().account;
    if (!account?.id) {
      set({ messageBadge: 0 });
      return;
    }
    try {
      const summary = await getMessageNotifications(account.id);
      set({ messageBadge: summary.unreadConversations });
    } catch {
      // garde la valeur actuelle
    }
  },
  toggleSavedRide: (ride) => {
    set((state) => {
      const next = { ...state.savedRides };
      if (next[ride.rideId]) {
        delete next[ride.rideId];
      } else {
        next[ride.rideId] = ride;
      }
      persistSavedRides(next);
      return { savedRides: next };
    });
  },
  removeSavedRide: (rideId) => {
    set((state) => {
      if (!state.savedRides[rideId]) return state;
      const next = { ...state.savedRides };
      delete next[rideId];
      persistSavedRides(next);
      return { savedRides: next };
    });
  },
  setRideAvailability: (rideId, seatsAvailable, seatsTotal) =>
    set((state) => {
      if (!rideId) return state;
      const prev = state.rideAvailability[rideId];
      if (
        prev &&
        prev.seatsAvailable === seatsAvailable &&
        (seatsTotal ?? prev.seatsTotal) === prev.seatsTotal
      ) {
        return state;
      }
      return {
        rideAvailability: {
          ...state.rideAvailability,
          [rideId]: {
            seatsAvailable,
            seatsTotal: seatsTotal ?? prev?.seatsTotal,
            updatedAt: Date.now(),
          },
        },
      };
    }),
}));

if (initialToken) {
  setApiAuthToken(initialToken);
}

registerUnauthorizedHandler(() => {
  const state = useApp.getState();
  if (state.token) {
    state.clearSession();
  }
});
