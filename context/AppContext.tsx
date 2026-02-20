import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { UserPreferences, DiningPlan, Restaurant } from '../types';
import { samplePlans } from '../mocks/plans';

const PREFS_KEY = 'chewabl_preferences';
const ONBOARDED_KEY = 'chewabl_onboarded';
const PLANS_KEY = 'chewabl_plans';
const FAVORITES_KEY = 'chewabl_favorites';

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: '',
    cuisines: [],
    budget: '$$',
    dietary: [],
    atmosphere: 'Moderate',
    groupSize: '2',
  });
  const [plans, setPlans] = useState<DiningPlan[]>(samplePlans);
  const [favorites, setFavorites] = useState<string[]>([]);

  const onboardedQuery = useQuery({
    queryKey: ['onboarded'],
    queryFn: async () => {
      const val = await AsyncStorage.getItem(ONBOARDED_KEY);
      return val === 'true';
    },
  });

  const prefsQuery = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PREFS_KEY);
      return stored ? JSON.parse(stored) as UserPreferences : null;
    },
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  useEffect(() => {
    if (onboardedQuery.data !== undefined) {
      setIsOnboarded(onboardedQuery.data);
    }
  }, [onboardedQuery.data]);

  useEffect(() => {
    if (prefsQuery.data) {
      setPreferences(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  useEffect(() => {
    if (favoritesQuery.data) {
      setFavorites(favoritesQuery.data);
    }
  }, [favoritesQuery.data]);

  const saveOnboarding = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return prefs;
    },
    onSuccess: (prefs) => {
      setIsOnboarded(true);
      setPreferences(prefs);
      queryClient.invalidateQueries({ queryKey: ['onboarded'] });
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      return prefs;
    },
    onSuccess: (prefs) => {
      setPreferences(prefs);
    },
  });

  const toggleFavorite = useCallback((restaurantId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(restaurantId)
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addPlan = useCallback((plan: DiningPlan) => {
    setPlans(prev => [plan, ...prev]);
  }, []);

  const isLoading = onboardedQuery.isLoading || prefsQuery.isLoading;

  return {
    isOnboarded,
    isLoading,
    preferences,
    plans,
    favorites,
    saveOnboarding,
    updatePreferences,
    toggleFavorite,
    addPlan,
  };
});
