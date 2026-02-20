import { api, setToken, clearToken } from './api';
import { BackendUser } from '../types';

interface AuthResponse {
  token: string;
  user: BackendUser;
}

export async function register(
  name: string,
  email: string,
  password: string,
  phone?: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { name, email, password, phone });
  await setToken(res.token);
  return res;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  await setToken(res.token);
  return res;
}

export async function logout(): Promise<void> {
  await clearToken();
}

export async function getMe(): Promise<BackendUser> {
  return api.get<BackendUser>('/users/me');
}

export async function updateProfile(updates: {
  name?: string;
  phone?: string;
  avatarUri?: string;
}): Promise<BackendUser> {
  return api.put<BackendUser>('/users/me', updates);
}

export async function registerPushToken(pushToken: string): Promise<void> {
  await api.post('/users/push-token', { pushToken });
}
