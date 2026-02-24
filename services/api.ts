import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'chewabl_auth_token';

/** Thrown on network / connectivity errors (timeout, no internet, DNS failure) */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Thrown when the server returns 401 (token expired or invalid) */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Please sign in again.');
    this.name = 'SessionExpiredError';
  }
}

// Dedup flag to prevent concurrent 401s from clearing token multiple times
let _handling401 = false;

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError('Request timed out. Please try again.');
      }
      throw new NetworkError(err instanceof TypeError
        ? 'Cannot connect to server. Please check your connection or try again later.'
        : String(err)
      );
    });

    if (response.status === 401) {
      if (!_handling401) {
        _handling401 = true;
        await clearToken();
        _handling401 = false;
      }
      throw new SessionExpiredError();
    }

    if (!response.ok) {
      const body = await response.text();
      let message = `API ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        message = parsed.error || message;
      } catch {
        // body wasn't JSON
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
