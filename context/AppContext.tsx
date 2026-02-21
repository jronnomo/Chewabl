import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import * as Location from 'expo-location';
import { UserPreferences, DiningPlan, Restaurant } from '../types';
import { samplePlans } from '../mocks/plans';
import {
  searchNearby,
  searchText,
  buildSearchNearbyParams,
  CUISINE_TYPE_MAP,
  Coords,
} from '../services/googlePlaces';
import { mapToRestaurant } from '../lib/placesMapper';
import { registerRestaurants } from '../lib/restaurantRegistry';
import { restaurants as mockRestaurants } from '../mocks/restaurants';

const PREFS_KEY = 'chewabl_preferences';
const ONBOARDED_KEY = 'chewabl_onboarded';
const PLANS_KEY = 'chewabl_plans';
const FAVORITES_KEY = 'chewabl_favorites';
const AVATAR_KEY = 'chewabl_avatar_uri';

const BUDGET_MAP: Record<string, string[]> = {
  '$': ['PRICE_LEVEL_INEXPENSIVE'],
  '$$': ['PRICE_LEVEL_MODERATE'],
  '$$$': ['PRICE_LEVEL_EXPENSIVE'],
  '$$$$': ['PRICE_LEVEL_VERY_EXPENSIVE'],
};

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
    distance: '5',
  });
  const [plans, setPlans] = useState<DiningPlan[]>(samplePlans);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [locationPermission, setLocationPermission] = useState<
    'undetermined' | 'granted' | 'denied'
  >('undetermined');

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
      return stored ? (JSON.parse(stored) as UserPreferences) : null;
    },
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    },
  });

  const avatarQuery = useQuery({
    queryKey: ['avatarUri'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(AVATAR_KEY);
      return stored ?? null;
    },
  });

  useEffect(() => {
    if (onboardedQuery.data !== undefined) {
      setIsOnboarded(onboardedQuery.data);
    }
  }, [onboardedQuery.data]);

  useEffect(() => {
    if (prefsQuery.data) {
      // Merge with defaults so legacy stored prefs without `distance` still work
      setPreferences(prev => ({ ...prev, ...prefsQuery.data, distance: prefsQuery.data!.distance ?? '5' }));
    }
  }, [prefsQuery.data]);

  useEffect(() => {
    if (favoritesQuery.data) {
      setFavorites(favoritesQuery.data);
    }
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (avatarQuery.data !== undefined) {
      setLocalAvatarUri(avatarQuery.data);
    }
  }, [avatarQuery.data]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermission('denied');
        return;
      }
      setLocationPermission('granted');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      setLocationPermission('denied');
    }
  }, []);

  // Request location once after onboarding is confirmed
  useEffect(() => {
    if (isOnboarded && !userLocation && locationPermission === 'undetermined') {
      requestLocation();
    }
  }, [isOnboarded]);

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

  const setLocalAvatar = useCallback(async (uri: string) => {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
    setLocalAvatarUri(uri);
  }, []);

  const isLoading = onboardedQuery.isLoading || prefsQuery.isLoading;

  return {
    isOnboarded,
    isLoading,
    preferences,
    plans,
    favorites,
    localAvatarUri,
    setLocalAvatar,
    userLocation,
    locationPermission,
    saveOnboarding,
    updatePreferences,
    toggleFavorite,
    addPlan,
    requestLocation,
  };
});

// ---------------------------------------------------------------------------
// Standalone React Query hooks – call these inside AppProvider children
// ---------------------------------------------------------------------------

export function useNearbyRestaurants() {
  const { preferences, userLocation } = useApp();

  return useQuery<Restaurant[]>({
    queryKey: [
      'nearbyRestaurants',
      preferences.cuisines,
      preferences.budget,
      preferences.atmosphere,
      preferences.distance,
      userLocation,
    ],
    queryFn: async () => {
      if (!userLocation) {
        console.log('[Places] No location yet, using mock data');
        return mockRestaurants;
      }
      console.log('[Places] Fetching nearby restaurants for', userLocation);
      try {
        const params = buildSearchNearbyParams(preferences, userLocation);
        // Always include at least 'restaurant' so the query is meaningful
        if (!params.includedTypes || params.includedTypes.length === 0) {
          params.includedTypes = ['restaurant'];
        }
        console.log('[Places] searchNearby params:', JSON.stringify(params));
        const places = await searchNearby(params);
        console.log('[Places] Got', places.length, 'results');
        if (places.length === 0) return mockRestaurants;
        const mapped = places.map(p => mapToRestaurant(p, userLocation));
        registerRestaurants(mapped);
        return mapped;
      } catch (err) {
        console.error('[Places] searchNearby failed:', err);
        return mockRestaurants;
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: mockRestaurants,
  });
}

export function useSearchRestaurants(
  query: string,
  cuisine: string,
  budget: string
) {
  const { preferences, userLocation } = useApp();

  return useQuery<Restaurant[]>({
    queryKey: ['searchRestaurants', query, cuisine, budget, userLocation],
    queryFn: async () => {
      try {
        const distanceMiles = parseFloat(preferences.distance || '5');
        const radiusMeters = Math.round(distanceMiles * 1609.34);
        const priceLevels = budget !== 'All' ? (BUDGET_MAP[budget] || []) : [];

        // Build text query: use typed query, or cuisine filter, or generic fallback
        let textQuery = query.trim();
        if (!textQuery) {
          textQuery = cuisine !== 'All' ? `${cuisine} restaurant` : 'restaurant';
        }

        // Map selected cuisine chip to an includedType for the API
        const includedType =
          cuisine !== 'All' && CUISINE_TYPE_MAP[cuisine]
            ? CUISINE_TYPE_MAP[cuisine][0]
            : undefined;

        console.log('[Places] searchText query:', textQuery, '| cuisine:', cuisine, '| budget:', budget);
        const places = await searchText({
          textQuery,
          location: userLocation || undefined,
          radiusMeters: userLocation ? radiusMeters : undefined,
          priceLevels: priceLevels.length > 0 ? priceLevels : undefined,
          includedType,
          maxResultCount: 20,
        });

        console.log('[Places] searchText got', places.length, 'results');
        if (places.length === 0) return mockRestaurants;
        const mapped = places.map(p => mapToRestaurant(p, userLocation || undefined));
        registerRestaurants(mapped);
        return mapped;
      } catch (err) {
        console.error('[Places] searchText failed:', err);
        return mockRestaurants;
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: mockRestaurants,
  });
}
