import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginAccount, registerIndividual } from './api/identity';
import { getMyProfile } from './api/bff';

const TOKEN_KEY = 'kari_token';
const ACCOUNT_KEY = 'kari_account';
const GUEST_KEY = 'kari_guest';

const AuthContext = createContext({
  token: null,
  account: null,
  guest: false,
  hydrated: false,
  login: async () => {},
  register: async () => {},
  applyAuth: () => {},
  logout: () => {},
  refreshProfile: async () => {},
  continueAsGuest: () => {},
});

const readSecureValue = async (key) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const writeSecureValue = async (key, value) => {
  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore persistence errors
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [account, setAccount] = useState(null);
  const [guest, setGuest] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const [storedToken, storedAccount, storedGuest] = await Promise.all([
        readSecureValue(TOKEN_KEY),
        readSecureValue(ACCOUNT_KEY),
        readSecureValue(GUEST_KEY),
      ]);
      if (!active) return;
      if (storedToken) {
        setToken(storedToken);
      }
      if (storedAccount) {
        try {
          setAccount(JSON.parse(storedAccount));
        } catch {
          setAccount(null);
        }
      }
      setGuest(storedGuest === 'true');
      setHydrated(true);
    };
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  const persistSession = async (nextToken, nextAccount, nextGuest) => {
    await Promise.all([
      writeSecureValue(TOKEN_KEY, nextToken || null),
      writeSecureValue(ACCOUNT_KEY, nextAccount ? JSON.stringify(nextAccount) : null),
      writeSecureValue(GUEST_KEY, nextGuest ? 'true' : null),
    ]);
  };

  const setSession = (nextToken, nextAccount) => {
    setToken(nextToken);
    setAccount(nextAccount || null);
    setGuest(false);
    persistSession(nextToken, nextAccount || null, false);
  };

  const login = async (email, password) => {
    const auth = await loginAccount(email, password);
    setSession(auth.token, auth.account);
    return auth;
  };

  const register = async (payload) => {
    const auth = await registerIndividual(payload);
    setSession(auth.token, auth.account);
    return auth;
  };

  const applyAuth = (auth) => {
    if (!auth) return;
    setSession(auth.token, auth.account);
  };

  const refreshProfile = async (nextToken) => {
    const effectiveToken = nextToken || token;
    if (!effectiveToken) return null;
    const profile = await getMyProfile(effectiveToken);
    setAccount(profile);
    setGuest(false);
    persistSession(effectiveToken, profile, false);
    return profile;
  };

  const logout = () => {
    setToken(null);
    setAccount(null);
    setGuest(false);
    persistSession(null, null, false);
  };

  const continueAsGuest = () => {
    setToken(null);
    setAccount(null);
    setGuest(true);
    persistSession(null, null, true);
  };

  const value = useMemo(
    () => ({
      token,
      account,
      guest,
      hydrated,
      login,
      register,
      applyAuth,
      logout,
      refreshProfile,
      continueAsGuest,
    }),
    [token, account, guest, hydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
