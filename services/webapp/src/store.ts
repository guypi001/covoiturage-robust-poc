import { create } from 'zustand';
import type { Ride } from './api';

type State = {
  lastSearch?: { from: string; to: string; date?: string };
  results: Ride[];
  loading: boolean;
  error?: string;
  passengerId: string; // simple demo
};
type Actions = {
  setPassenger: (id: string) => void;
  setSearch: (q: State['lastSearch']) => void;
  setResults: (r: Ride[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e?: string) => void;
};

export const useApp = create<State & Actions>((set) => ({
  results: [],
  loading: false,
  passengerId: 'usr-demo',
  setPassenger: (id) => set({ passengerId: id }),
  setSearch: (q) => set({ lastSearch: q }),
  setResults: (r) => set({ results: r }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e })
}));
