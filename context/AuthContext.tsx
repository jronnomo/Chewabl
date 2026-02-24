import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { BackendUser } from '../types';
import * as authService from '../services/auth';
import { getToken, clearToken, NetworkError, api } from '../services/api';

const CACHED_USER_KEY = 'chewabl_cached_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount: check for stored token and fetch current user
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          try {
            const me = await authService.getMe();
            setUser(me);
            setIsAuthenticated(true);
            // Cache user for offline resilience
            await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
          } catch (err: unknown) {
            if (err instanceof NetworkError) {
              // Network error — restore from cache so auth state persists offline
              const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
              if (cached) {
                setUser(JSON.parse(cached) as BackendUser);
                setIsAuthenticated(true);
              }
            } else {
              // Likely 401/invalid token — clear it
              await clearToken();
              await AsyncStorage.removeItem(CACHED_USER_KEY);
            }
          }
        }
      } catch {
        // AsyncStorage/token read failure — stay unauthenticated
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<BackendUser> => {
    const res = await authService.login(email, password);
    setUser(res.user);
    setIsAuthenticated(true);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(res.user)).catch(() => {});
    return res.user;
  }, []);

  const signUp = useCallback(async (
    name: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<void> => {
    const res = await authService.register(name, email, password, phone);
    setUser(res.user);
    setIsAuthenticated(true);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(res.user)).catch(() => {});
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    // Clear push token on backend before logout (best-effort)
    try { await api.delete('/users/push-token'); } catch { /* ignore */ }
    await authService.logout();
    await AsyncStorage.removeItem(CACHED_USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
    // F-011-005: Clear all cached data to prevent stale data leak between users
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((updates: Partial<BackendUser>): void => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    updateUser,
  };
});
