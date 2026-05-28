'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const ACCESS_KEY = 'pc_access_token';
const REFRESH_KEY = 'pc_refresh_token';

export const tokenStore = {
  getAccess: () => (typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY)),
  getRefresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  set: (access: string, refresh: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      tokenStore.set(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  raw?: boolean;
  skipAuth?: boolean;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, skipAuth } = opts;
  const url = new URL(API_URL + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }

  async function doRequest(token: string | null): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token && !skipAuth) headers.Authorization = `Bearer ${token}`;
    return fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let token = skipAuth ? null : tokenStore.getAccess();
  let res = await doRequest(token);
  if (res.status === 401 && !skipAuth) {
    const fresh = await tryRefresh();
    if (fresh) {
      res = await doRequest(fresh);
    }
  }

  if (res.status === 204) return undefined as unknown as T;
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const code = json?.error?.code || 'internal';
    const message = json?.error?.message || `Request failed (${res.status})`;
    throw new ApiError(res.status, code, message);
  }
  return (json?.data ?? json) as T;
}
