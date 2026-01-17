import { createContext, useContext, useMemo, useState } from 'react';
import { loginAccount } from './api/identity';
import { getMyProfile } from './api/bff';

const AuthContext = createContext({
  token: null,
  account: null,
  login: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [account, setAccount] = useState(null);

  const login = async (email, password) => {
    const auth = await loginAccount(email, password);
    setToken(auth.token);
    setAccount(auth.account || null);
    return auth;
  };

  const refreshProfile = async (nextToken) => {
    const effectiveToken = nextToken || token;
    if (!effectiveToken) return null;
    const profile = await getMyProfile(effectiveToken);
    setAccount(profile);
    return profile;
  };

  const logout = () => {
    setToken(null);
    setAccount(null);
  };

  const value = useMemo(
    () => ({ token, account, login, logout, refreshProfile }),
    [token, account],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
