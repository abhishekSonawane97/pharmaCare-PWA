'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, tokenStore, ApiError } from './api';
import type { User } from './types';
import { TenantId, rememberTenant } from './tenants';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenant: TenantId) => Promise<void>;
  signup: (data: { name: string; email: string; phone: string; password: string; tenant: TenantId }) => Promise<{ pending: boolean; user: User }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    if (!tokenStore.getAccess()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Route guard — redirect unauthenticated users to /login (except login itself)
  useEffect(() => {
    if (loading) return;
    const isAuthPage = pathname === '/login';
    if (!user && !isAuthPage) {
      router.replace('/login');
    } else if (user && isAuthPage) {
      router.replace('/');
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (email: string, password: string, tenant: TenantId) => {
    const data = await api<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password, tenant },
      skipAuth: true,
    });
    tokenStore.set(data.accessToken, data.refreshToken);
    rememberTenant(tenant);
    setUser(data.user);
  }, []);

  const signup = useCallback(async (payload: { name: string; email: string; phone: string; password: string; tenant: TenantId }) => {
    const data = await api<{ user: User; accessToken?: string; refreshToken?: string }>('/auth/signup', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
    if (data.accessToken && data.refreshToken) {
      tokenStore.set(data.accessToken, data.refreshToken);
      rememberTenant(payload.tenant);
      setUser(data.user);
      return { pending: false, user: data.user };
    }
    return { pending: true, user: data.user };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      // ignore — token may already be invalid
      if (!(err instanceof ApiError)) console.error(err);
    }
    tokenStore.clear();
    setUser(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
