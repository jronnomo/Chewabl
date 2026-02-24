import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { X, Heart, ArrowLeft, RotateCcw, Star, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import SwipeCard from '@/components/SwipeCard';
import { useApp, useNearbyRestaurants } from '@/context/AppContext';
import { Restaurant } from '@/types';
import StaticColors from '@/constants/colors';
import { useColors } from '@/context/ThemeContext';

const Colors = StaticColors;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SwipeScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, toggleFavorite, favorites, locationPermission, requestLocation } = useApp();
  const { data: restaurantData = [], isFetching } = useNearbyRestaurants();

  const sortedRestaurants = React.useMemo(() => {
    return [...restaurantData].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (preferences.cuisines.includes(a.cuisine)) scoreA += 2;
      if (preferences.cuisines.includes(b.cuisine)) scoreB += 2;
      if (a.isOpenNow) scoreA += 1;
      if (b.isOpenNow) scoreB += 1;
      return scoreB - scoreA;
    });
  }, [restaurantData, preferences.cuisines]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [liked, setLiked] = useState<Restaurant[]>([]);
  const [passed, setPassed] = useState<Restaurant[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [lastSwiped, setLastSwiped] = useState<{ restaurant: Restaurant; direction: 'left' | 'right'; wasFavorite: boolean } | null>(null);

  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const counterScale = useRef(new Animated.Value(1)).current;
  const showResultsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (showResultsTimer.current) clearTimeout(showResultsTimer.current);
    };
  }, []);

  const animateCounter = useCallback(() => {
    Animated.sequence([
      Animated.timing(counterScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(counterScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  }, [counterScale]);

  const handleSwipeRight = useCallback((restaurant: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(prev => [...prev, restaurant]);
    // Only add to favorites, never toggle off
    if (!favorites.includes(restaurant.id)) {
      toggleFavorite(restaurant);
    }
    setLastSwiped({ restaurant, direction: 'right', wasFavorite: favorites.includes(restaurant.id) });
    animateCounter();
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= sortedRestaurants.length) {
        setShowResults(true);
      }
      return next;
    });
  }, [sortedRestaurants.length, toggleFavorite, favorites, animateCounter]);

  const handleSwipeLeft = useCallback((restaurant: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPassed(prev => [...prev, restaurant]);
    setLastSwiped({ restaurant, direction: 'left', wasFavorite: false });
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= sortedRestaurants.length) {
        setShowResults(true);
      }
      return next;
    });
  }, [sortedRestaurants.length]);

  const handleUndo = useCallback(() => {
    if (!lastSwiped || currentIndex <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { restaurant, direction, wasFavorite } = lastSwiped;
    if (direction === 'right') {
      setLiked(prev => prev.filter(r => r.id !== restaurant.id));
      // Only remove from favorites if it was newly added by this swipe
      if (!wasFavorite && favorites.includes(restaurant.id)) {
        toggleFavorite(restaurant);
      }
    } else {
      setPassed(prev => prev.filter(r => r.id !== restaurant.id));
    }
    setCurrentIndex(prev => prev - 1);
    setShowResults(false);
    setLastSwiped(null);
  }, [lastSwiped, currentIndex, favorites, toggleFavorite]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentIndex(0);
    setLiked([]);
    setPassed([]);
    setShowResults(false);
    setLastSwiped(null);
  }, []);

  useEffect(() => {
    if (showResults) {
      Animated.timing(resultsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      resultsOpacity.setValue(0);
    }
  }, [showResults, resultsOpacity]);

  const progress = sortedRestaurants.length > 0
    ? currentIndex / sortedRestaurants.length
    : 0;

  // Loading state — differentiate from empty stack
  if (isFetching && sortedRestaurants.length === 0) {
    return (
      <View style={[styles.container, styles.centeredState, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: Colors.textSecondary }]}>Finding restaurants near you…</Text>
      </View>
    );
  }

  // No restaurants at all (not loading)
  if (!isFetching && sortedRestaurants.length === 0) {
    return (
      <View style={[styles.container, styles.centeredState, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <Text style={styles.emptyStackEmoji}>🍽</Text>
        <Text style={[styles.emptyStackText, { color: Colors.textSecondary }]}>No restaurants found nearby</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (showResults) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <Animated.View style={[styles.resultsContainer, { opacity: resultsOpacity }]}>
          <View style={styles.resultsHeader}>
            <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
              <ArrowLeft size={20} color={Colors.text} />
            </Pressable>
            <Text style={[styles.resultsTitle, { color: Colors.text }]}>Your Picks</Text>
            <Pressable style={[styles.resetBtn, { backgroundColor: Colors.primaryLight }]} onPress={handleReset} accessibilityLabel="Reset swipes" accessibilityRole="button">
              <RotateCcw size={18} color={Colors.primary} />
            </Pressable>
          </View>

          {liked.length === 0 ? (
            <View style={styles.emptyResults}>
              <Text style={styles.emptyEmoji}>🤷</Text>
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>Nothing caught your eye?</Text>
              <Text style={[styles.emptySub, { color: Colors.textSecondary }]}>Try swiping again with fresh eyes</Text>
              <Pressable style={styles.retryBtn} onPress={handleReset}>
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent}>
              <Text style={[styles.resultsCount, { color: Colors.textSecondary }]}>
                You liked {liked.length} restaurant{liked.length !== 1 ? 's' : ''}
              </Text>
              {liked.map((r, i) => (
                <Pressable
                  key={r.id}
                  style={[styles.resultCard, { backgroundColor: Colors.card }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/restaurant/${r.id}` as never);
                  }}
                >
                  <View style={[styles.resultRank, { backgroundColor: Colors.primaryLight }]}>
                    <Text style={styles.resultRankText}>{i + 1}</Text>
                  </View>
                  <Image source={{ uri: r.imageUrl }} style={styles.resultImage} contentFit="cover" />
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: Colors.text }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.resultCuisine, { color: Colors.textSecondary }]}>{r.cuisine} · {'$'.repeat(r.priceLevel)}</Text>
                    <View style={styles.resultMeta}>
                      <Star size={11} color={Colors.star} fill={Colors.star} />
                      <Text style={[styles.resultRating, { color: Colors.text }]}>{r.rating}</Text>
                      <MapPin size={11} color={Colors.textTertiary} />
                      <Text style={[styles.resultDistance, { color: Colors.textTertiary }]}>{r.distance}</Text>
                    </View>
                  </View>
                  <Heart size={18} color={Colors.primary} fill={Colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} testID="swipe-back" accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={20} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Discover</Text>
          <Text style={[styles.headerSub, { color: Colors.textTertiary }]}>
            {currentIndex} / {sortedRestaurants.length}
          </Text>
        </View>
        <Animated.View style={[styles.likeCounter, { backgroundColor: Colors.primaryLight, transform: [{ scale: counterScale }] }]}>
          <Heart size={14} color={Colors.primary} fill={liked.length > 0 ? Colors.primary : 'transparent'} />
          <Text style={[styles.likeCountText, { color: Colors.primary }]}>{liked.length}</Text>
        </Animated.View>
      </View>

      <View style={[styles.progressBarContainer, { backgroundColor: Colors.border }]}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      {locationPermission === 'denied' && (
        <Pressable style={[styles.locationBanner, { backgroundColor: Colors.primaryLight }]} onPress={requestLocation}>
          <MapPin size={14} color={Colors.primary} />
          <Text style={[styles.locationBannerText, { color: Colors.primary }]}>
            Enable location for nearby restaurants
          </Text>
        </Pressable>
      )}

      <View style={styles.cardStack}>
        {sortedRestaurants.slice(currentIndex, currentIndex + 2).reverse().map((restaurant, i) => {
          const isTop = i === (Math.min(2, sortedRestaurants.length - currentIndex) - 1);
          return (
            <SwipeCard
              key={restaurant.id}
              restaurant={restaurant}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              isTop={isTop}
            />
          );
        })}

        {currentIndex >= sortedRestaurants.length && !showResults && (
          <View style={styles.emptyStack}>
            <Text style={styles.emptyStackEmoji}>🍽</Text>
            <Text style={[styles.emptyStackText, { color: Colors.textSecondary }]}>That's all for now!</Text>
          </View>
        )}
      </View>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnNo, { backgroundColor: Colors.card }]}
          onPress={() => {
            if (currentIndex < sortedRestaurants.length) {
              handleSwipeLeft(sortedRestaurants[currentIndex]);
            }
          }}
          testID="swipe-no-btn"
          accessibilityLabel="Pass on restaurant"
          accessibilityRole="button"
        >
          <X size={28} color={Colors.error} />
        </Pressable>

        {lastSwiped && currentIndex > 0 && (
          <Pressable
            style={[styles.actionBtn, styles.undoBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]}
            onPress={handleUndo}
            testID="swipe-undo-btn"
            accessibilityLabel="Undo last swipe"
            accessibilityRole="button"
          >
            <RotateCcw size={22} color={Colors.textSecondary} />
          </Pressable>
        )}

        <Pressable
          style={[styles.actionBtn, styles.actionBtnYes]}
          onPress={() => {
            if (currentIndex < sortedRestaurants.length) {
              handleSwipeRight(sortedRestaurants[currentIndex]);
            }
          }}
          testID="swipe-yes-btn"
          accessibilityLabel="Like restaurant"
          accessibilityRole="button"
        >
          <Heart size={28} color="#FFF" fill="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  likeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  likeCountText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyStack: {
    alignItems: 'center',
  },
  emptyStackEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStackText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnNo: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  actionBtnYes: {
    backgroundColor: Colors.primary,
  },
  undoBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  resetBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingTop: 8,
    paddingBottom: 30,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRankText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  resultCuisine: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  resultRating: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  resultDistance: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  emptyResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  locationBannerText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
