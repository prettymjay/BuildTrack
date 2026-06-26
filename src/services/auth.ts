type LoginResult = {
  success: boolean;
  token?: string;
  user?: { username: string; name?: string };
  error?: string;
};

type ResetResult = {
  success: boolean;
  message?: string;
  expiresInMinutes?: number;
  error?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const OFFLINE_API_BASE = 'http://127.0.0.1:4000';
const INVALID_CREDENTIALS_MESSAGE = 'Wrong username or wrong password.';
const CONNECTION_ERROR_MESSAGE = 'Unable to reach the local app server. Start the offline server and confirm VITE_API_BASE is correct.';

function getApiBases() {
  const bases = [API_BASE, '', OFFLINE_API_BASE];
  return bases.filter((base, index) => bases.findIndex((candidate) => candidate === base) === index);
}

function isInvalidCredentialMessage(message?: string) {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return [
    'invalid credentials',
    'wrong username or email',
    'wrong password',
    INVALID_CREDENTIALS_MESSAGE.toLowerCase(),
  ].includes(normalized);
}

export async function login(username: string, password: string): Promise<LoginResult> {
  for (const base of getApiBases()) {
    try {
      const resp = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const message = err.error || err.message || 'Login failed';
        return {
          success: false,
          error: isInvalidCredentialMessage(message) ? INVALID_CREDENTIALS_MESSAGE : message,
        };
      }

      const data = await resp.json();
      return { success: true, token: data.token, user: data.user };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    error: CONNECTION_ERROR_MESSAGE,
  };
}

export async function requestPasswordReset(email: string): Promise<ResetResult> {
  for (const base of getApiBases()) {
    try {
      const resp = await fetch(`${base}/api/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { success: false, error: err.error || err.message || 'Request failed' };
      }

      const data = await resp.json();
      return { success: true, message: data.message, expiresInMinutes: data.expiresInMinutes };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    error: CONNECTION_ERROR_MESSAGE,
  };
}

export async function resetPassword(email: string, token: string, password: string): Promise<ResetResult> {
  for (const base of getApiBases()) {
    try {
      const resp = await fetch(`${base}/api/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { success: false, error: err.error || err.message || 'Reset failed' };
      }

      return { success: true };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    error: CONNECTION_ERROR_MESSAGE,
  };
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
