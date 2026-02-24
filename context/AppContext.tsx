import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import * as Location from 'expo-location';
import { UserPreferences, DiningPlan, Restaurant } from '../types';

import { useAuth } from './AuthContext';
import { updateProfile } from '../services/auth';
import { getPlans } from '../services/plans';
import {
  searchNearby,
  searchText,
  buildSearchNearbyParams,
  CUISINE_TYPE_MAP,
  Coords,
} from '../services/googlePlaces';
import { mapToRestaurant } from '../lib/placesMapper';
import { registerRestaurants } from '../lib/restaurantRegistry';

const PREFS_KEY = 'chewabl_preferences';
const ONBOARDED_KEY = 'chewabl_onboarded';
const PLANS_KEY = 'chewabl_plans';
const FAVORITES_KEY = 'chewabl_favorites';
const FAVORITE_RESTAURANTS_KEY = 'chewabl_favorite_restaurants';
const AVATAR_KEY = 'chewabl_avatar_uri';

const BUDGET_MAP: Record<string, string[]> = {
  '$': ['PRICE_LEVEL_INEXPENSIVE'],
  '$$': ['PRICE_LEVEL_MODERATE'],
  '$$$': ['PRICE_LEVEL_EXPENSIVE'],
  '$$$$': ['PRICE_LEVEL_VERY_EXPENSIVE'],
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
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
  const [localPlans, setLocalPlans] = useState<DiningPlan[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritedRestaurants, setFavoritedRestaurants] = useState<Restaurant[]>([]);
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

  const favoritedRestaurantsQuery = useQuery({
    queryKey: ['favoritedRestaurants'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(FAVORITE_RESTAURANTS_KEY);
      return stored ? (JSON.parse(stored) as Restaurant[]) : [];
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

  // Auto-onboard when an authenticated user already has preferences on the backend
  useEffect(() => {
    if (isAuthenticated && user?.preferences && !isOnboarded) {
      setIsOnboarded(true);
      AsyncStorage.setItem(ONBOARDED_KEY, 'true').catch(() => {});
    }
  }, [isAuthenticated, user?.preferences, isOnboarded]);

  // Hydrate preferences from server when authenticated, otherwise from AsyncStorage
  useEffect(() => {
    if (isAuthenticated && user?.preferences) {
      setPreferences(prev => ({
        ...prev,
        ...user.preferences,
        distance: user.preferences!.distance ?? '5',
      }));
    } else if (!isAuthenticated && prefsQuery.data) {
      setPreferences(prev => ({ ...prev, ...prefsQuery.data, distance: prefsQuery.data!.distance ?? '5' }));
    }
  }, [isAuthenticated, user, prefsQuery.data]);

  // Hydrate favorites from server when authenticated, otherwise from AsyncStorage
  useEffect(() => {
    if (isAuthenticated && user?.favorites) {
      setFavorites(user.favorites);
    } else if (!isAuthenticated && favoritesQuery.data) {
      setFavorites(favoritesQuery.data);
    }
  }, [isAuthenticated, user, favoritesQuery.data]);

  useEffect(() => {
    if (favoritedRestaurantsQuery.data) {
      setFavoritedRestaurants(favoritedRestaurantsQuery.data);
    }
  }, [favoritedRestaurantsQuery.data]);

  useEffect(() => {
    if (avatarQuery.data !== undefined) {
      setLocalAvatarUri(avatarQuery.data);
    }
  }, [avatarQuery.data]);

  // Sync avatar from backend user when authenticated (survives cache clears / reinstalls)
  useEffect(() => {
    if (isAuthenticated && user?.avatarUri) {
      setLocalAvatarUri(user.avatarUri);
      AsyncStorage.setItem(AVATAR_KEY, user.avatarUri).catch(() => {});
    }
  }, [isAuthenticated, user?.avatarUri]);

  // Fetch plans from backend when authenticated
  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const plans = isAuthenticated
    ? (plansQuery.data ?? [])
    : [];

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
  }, [isOnboarded, userLocation, locationPermission, requestLocation]);

  const saveOnboarding = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      if (isAuthenticated) {
        await updateProfile({ preferences: prefs });
      }
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
      if (isAuthenticated) {
        await updateProfile({ preferences: prefs });
      }
      return prefs;
    },
    onSuccess: (prefs) => {
      setPreferences(prefs);
    },
  });

  const toggleFavorite = useCallback((restaurant: Restaurant) => {
    const restaurantId = restaurant.id;
    setFavorites(prev => {
      const isRemoving = prev.includes(restaurantId);
      const updated = isRemoving
        ? prev.filter(id => id !== restaurantId)
        : [...prev, restaurantId];

      // Update cached restaurant objects
      setFavoritedRestaurants(prevRestaurants => {
        const updatedRestaurants = isRemoving
          ? prevRestaurants.filter(r => r.id !== restaurantId)
          : [...prevRestaurants.filter(r => r.id !== restaurantId), restaurant];
        AsyncStorage.setItem(FAVORITE_RESTAURANTS_KEY, JSON.stringify(updatedRestaurants)).catch(err =>
          console.error('[FavoritedRestaurants] AsyncStorage write failed:', err)
        );
        return updatedRestaurants;
      });

      (async () => {
        try {
          await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error('[Favorites] AsyncStorage write failed:', err);
        }
        if (isAuthenticated) {
          try {
            await updateProfile({ favorites: updated });
          } catch (err) {
            console.error('[Favorites] Backend sync failed:', err);
          }
        }
      })();
      return updated;
    });
  }, [isAuthenticated]);

  const addPlan = useCallback((plan: DiningPlan) => {
    if (isAuthenticated) {
      // Optimistic update: add plan to cache immediately, then refetch
      queryClient.setQueryData<DiningPlan[]>(['plans'], old => [plan, ...(old ?? [])]);
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    } else {
      setLocalPlans(prev => [plan, ...prev]);
    }
  }, [isAuthenticated, queryClient]);

  const setLocalAvatar = useCallback(async (uri: string) => {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
    setLocalAvatarUri(uri);
  }, []);

  const isLoading = authLoading || onboardedQuery.isLoading || prefsQuery.isLoading
    || (isAuthenticated && plansQuery.isLoading);

  return {
    isOnboarded,
    isLoading,
    preferences,
    plans,
    favorites,
    favoritedRestaurants,
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
      userLocation?.latitude,
      userLocation?.longitude,
    ],
    queryFn: async () => {
      if (!userLocation) {
        return [];
      }
      const params = buildSearchNearbyParams(preferences, userLocation);
      // Always include at least 'restaurant' so the query is meaningful
      if (!params.includedTypes || params.includedTypes.length === 0) {
        params.includedTypes = ['restaurant'];
      }
      const places = await searchNearby(params);
      if (places.length === 0) return [];
      const mapped = places.map(p => mapToRestaurant(p, userLocation));
      registerRestaurants(mapped);
      return mapped;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchRestaurants(
  query: string,
  cuisine: string,
  budget: string
) {
  const { preferences, userLocation } = useApp();

  return useQuery<Restaurant[]>({
    queryKey: ['searchRestaurants', query, cuisine, budget, userLocation?.latitude, userLocation?.longitude],
    queryFn: async () => {
      const distanceMiles = parseFloat(preferences.distance || '5');
      const radiusMeters = Math.round(distanceMiles * 1609.34);
      const priceLevels = budget !== 'All' ? (BUDGET_MAP[budget] || []) : [];

      // Build text query: use typed query, or cuisine filter, or generic fallback
      let textQuery = query.trim();
      if (!textQuery) {
        textQuery = cuisine !== 'All' ? `${cuisine} restaurant` : 'restaurant';
      }

      // Map selected cuisine chip to an includedType for the API
      // Only use includedType when the cuisine maps to a single type;
      // when multiple types exist, rely on the text query for filtering
      const cuisineTypes =
        cuisine !== 'All' && CUISINE_TYPE_MAP[cuisine]
          ? CUISINE_TYPE_MAP[cuisine]
          : [];
      const includedType = cuisineTypes.length === 1 ? cuisineTypes[0] : undefined;

      const places = await searchText({
        textQuery,
        location: userLocation || undefined,
        radiusMeters: userLocation ? radiusMeters : undefined,
        priceLevels: priceLevels.length > 0 ? priceLevels : undefined,
        includedType,
        maxResultCount: 20,
      });

      // Return actual results — empty array for zero results, not mock data
      if (places.length === 0) return [];
      const mapped = places.map(p => mapToRestaurant(p, userLocation || undefined));
      registerRestaurants(mapped);
      return mapped;
    },
    // Only fire when we have a location or a search query
    enabled: !!(userLocation || query.trim()),
    staleTime: 5 * 60 * 1000,
  });
}
