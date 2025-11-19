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
  fromMeta?: LocationMeta;
  toMeta?: LocationMeta;
};

type State = {
  lastSearch?: LastSearch;
  results: Ride[];
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
};

type Actions = {
  setPassenger: (id: string) => void;
  setSearch: (q: LastSearch | undefined) => void;
  setResults: (r: Ride[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e?: string) => void;
  setSession: (token: string, account: Account) => void;
  clearSession: () => void;
  initializeAuth: () => Promise<void>;
  refreshMessageBadge: () => Promise<void>;
  toggleSavedRide: (ride: SavedRide) => void;
  removeSavedRide: (rideId: string) => void;
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
  setPassenger: (id) => set({ passengerId: id }),
  setSearch: (q) => set({ lastSearch: q }),
  setResults: (r) => set({ results: r }),
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
      results: [],
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
