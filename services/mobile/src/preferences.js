import * as SecureStore from 'expo-secure-store';

const PREFS_KEY = 'kari_prefs';

const fallbackPrefs = {
  homeDefaults: {
    fromCity: 'Abidjan',
    toCity: 'Yamoussoukro',
    seats: '1',
  },
  searchDefaults: {
    fromCity: 'Abidjan',
    toCity: 'Yamoussoukro',
    seats: '1',
    budget: '',
    liveTracking: true,
    sort: 'soonest',
  },
  appSettings: {
    appearance: 'system',
    haptics: true,
    compactCards: false,
    autoPlayAnimations: true,
  },
};

export async function loadPreferences() {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return fallbackPrefs;
    const parsed = JSON.parse(raw);
    return {
      ...fallbackPrefs,
      ...parsed,
      homeDefaults: { ...fallbackPrefs.homeDefaults, ...(parsed.homeDefaults || {}) },
      searchDefaults: { ...fallbackPrefs.searchDefaults, ...(parsed.searchDefaults || {}) },
      appSettings: { ...fallbackPrefs.appSettings, ...(parsed.appSettings || {}) },
    };
  } catch {
    return fallbackPrefs;
  }
}

export async function savePreferences(nextPrefs) {
  try {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(nextPrefs));
  } catch {
    // ignore persistence errors
  }
}
