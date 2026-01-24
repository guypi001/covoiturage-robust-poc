import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const SAVED_KEY = 'kari_saved_rides';

const SavedRidesContext = createContext({
  savedRides: {},
  hydrated: false,
  toggleSavedRide: () => {},
  isSaved: () => false,
});

const readSaved = async () => {
  try {
    const raw = await SecureStore.getItemAsync(SAVED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const persistSaved = async (value) => {
  try {
    await SecureStore.setItemAsync(SAVED_KEY, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

export function SavedRidesProvider({ children }) {
  const [savedRides, setSavedRides] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const stored = await readSaved();
      if (!active) return;
      setSavedRides(stored);
      setHydrated(true);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const toggleSavedRide = async (ride) => {
    if (!ride?.rideId) return;
    setSavedRides((prev) => {
      const next = { ...prev };
      if (next[ride.rideId]) {
        delete next[ride.rideId];
      } else {
        next[ride.rideId] = ride;
      }
      persistSaved(next);
      return next;
    });
  };

  const isSaved = (rideId) => Boolean(rideId && savedRides?.[rideId]);

  const value = useMemo(
    () => ({
      savedRides,
      hydrated,
      toggleSavedRide,
      isSaved,
    }),
    [savedRides, hydrated],
  );

  return <SavedRidesContext.Provider value={value}>{children}</SavedRidesContext.Provider>;
}

export function useSavedRides() {
  return useContext(SavedRidesContext);
}
