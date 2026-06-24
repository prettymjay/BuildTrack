type LoginResult = {
  success: boolean;
  token?: string;
  user?: { username: string; name?: string };
  error?: string;
};

type ResetResult = {
  success: boolean;
  resetToken?: string;
  expiresInMinutes?: number;
  error?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const resp = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { success: false, error: err.error || 'Login failed' };
    }

    const data = await resp.json();
    return { success: true, token: data.token, user: data.user };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export async function requestPasswordReset(username: string): Promise<ResetResult> {
  try {
    const resp = await fetch(`${API_BASE}/api/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { success: false, error: err.error || 'Request failed' };
    }

    const data = await resp.json();
    return { success: true, resetToken: data.resetToken, expiresInMinutes: data.expiresInMinutes };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export async function resetPassword(username: string, token: string, password: string): Promise<ResetResult> {
  try {
    const resp = await fetch(`${API_BASE}/api/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, token, password }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { success: false, error: err.error || 'Reset failed' };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_user');
}

// Persist token either to localStorage (remember) or sessionStorage (session-only)
export function persistToken(token: string, user: { username: string; name?: string }, remember = false) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem('auth_token', token);
  store.setItem('auth_user', JSON.stringify(user));
}

export function getPersistedUser() {
  const userLocal = localStorage.getItem('auth_user');
  if (userLocal) {
    try { return JSON.parse(userLocal); } catch { /* fallthrough */ }
  }
  const userSession = sessionStorage.getItem('auth_user');
  if (userSession) {
    try { return JSON.parse(userSession); } catch { /* fallthrough */ }
  }
  return null;
}

export function getToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

// helper to attach Authorization header
export function authFetch(input: RequestInfo, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
