import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { BackendUser } from '../types';
import * as authService from '../services/auth';
import { getToken, clearToken } from '../services/api';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount: check for stored token and fetch current user
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await authService.getMe();
          setUser(me);
          setIsAuthenticated(true);
        }
      } catch {
        // Token invalid or expired — clear it
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await authService.login(email, password);
    setUser(res.user);
    setIsAuthenticated(true);
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
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

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
