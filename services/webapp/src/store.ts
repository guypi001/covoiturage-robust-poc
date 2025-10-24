import { create } from 'zustand';
import type { Ride, Account } from './api';
import { getMyProfile } from './api';

const TOKEN_KEY = 'kari_token';
const getStoredToken = () =>
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) ?? undefined : undefined;
const persistToken = (token?: string) => {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
};
const initialToken = getStoredToken();

type LastSearch = { from: string; to: string; date?: string; seats?: number };

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
};

export const useApp = create<State & Actions>((set, get) => ({
  results: [],
  loading: false,
  passengerId: 'usr-demo',
  token: initialToken,
  authLoading: false,
  authReady: initialToken ? false : true,
  setPassenger: (id) => set({ passengerId: id }),
  setSearch: (q) => set({ lastSearch: q }),
  setResults: (r) => set({ results: r }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setSession: (token, account) => {
    persistToken(token);
    set({
      token,
      account,
      authLoading: false,
      authReady: true,
      authError: undefined,
      passengerId: account.id || 'usr-demo',
    });
  },
  clearSession: () => {
    persistToken(undefined);
    set({
      token: undefined,
      account: undefined,
      authReady: true,
      authLoading: false,
      authError: undefined,
      lastSearch: undefined,
      results: [],
      passengerId: 'usr-demo',
    });
  },
  initializeAuth: async () => {
    const { authReady, authLoading } = get();
    if (authReady || authLoading) return;
    const token = get().token;
    if (!token) {
      set({ authReady: true, authLoading: false, authError: undefined });
      return;
    }
    try {
      set({ authLoading: true, authError: undefined });
      const account = await getMyProfile(token);
      set({
        account,
        authReady: true,
        authLoading: false,
        authError: undefined,
        passengerId: account.id || 'usr-demo',
      });
    } catch (e: any) {
      persistToken(undefined);
      set({
        token: undefined,
        account: undefined,
        authReady: true,
        authLoading: false,
        authError: e?.message || 'Session invalide',
      });
    }
  },
}));
