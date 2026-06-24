import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/auth';

type User = { username: string; name?: string } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const persisted = authService.getPersistedUser();
    const t = authService.getToken();
    if (persisted && t) {
      setUser(persisted);
      setToken(t);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string, remember = false) => {
    const res = await authService.login(username, password);
    if (!res.success) return { success: false, error: res.error };
    if (res.token && res.user) {
      authService.persistToken(res.token, res.user, remember);
      setUser(res.user);
      setToken(res.token);
      return { success: true };
    }
    return { success: false, error: 'Login failed' };
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
