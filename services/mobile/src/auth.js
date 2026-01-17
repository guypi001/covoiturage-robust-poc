import { createContext, useContext, useMemo, useState } from 'react';
import { loginAccount, registerIndividual } from './api/identity';
import { getMyProfile } from './api/bff';

const AuthContext = createContext({
  token: null,
  account: null,
  guest: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
  continueAsGuest: () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [account, setAccount] = useState(null);
  const [guest, setGuest] = useState(false);

  const setSession = (nextToken, nextAccount) => {
    setToken(nextToken);
    setAccount(nextAccount || null);
    setGuest(false);
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

  const refreshProfile = async (nextToken) => {
    const effectiveToken = nextToken || token;
    if (!effectiveToken) return null;
    const profile = await getMyProfile(effectiveToken);
    setAccount(profile);
    setGuest(false);
    return profile;
  };

  const logout = () => {
    setToken(null);
    setAccount(null);
    setGuest(false);
  };

  const continueAsGuest = () => {
    setToken(null);
    setAccount(null);
    setGuest(true);
  };

  const value = useMemo(
    () => ({ token, account, guest, login, register, logout, refreshProfile, continueAsGuest }),
    [token, account, guest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
