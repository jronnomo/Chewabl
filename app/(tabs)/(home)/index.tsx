import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { Zap, CalendarPlus, Flame, TrendingUp, Sparkles, ChevronRight, Heart, Users, Clock, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { openSettings } from 'expo-linking';
import { useApp, useNearbyRestaurants } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import RestaurantCard from '../../../components/RestaurantCard';
import StaticColors from '../../../constants/colors';
import { useColors } from '../../../context/ThemeContext';

const Colors = StaticColors;

export default function HomeScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, isOnboarded, isLoading, locationPermission, requestLocation } = useApp();
  const { user, isAuthenticated } = useAuth();
  const { data: allRestaurants = [] } = useNearbyRestaurants();

  const tonightNearYou = allRestaurants.filter(r => r.isOpenNow).slice(0, 5);
  const lastCallDeals = allRestaurants.filter(r => r.lastCallDeal);
  const closingSoon = allRestaurants.filter(r => r.closingSoon);
  const trendingWithFriends = allRestaurants.filter(r => r.rating >= 4.5).slice(0, 5);
  const basedOnPastPicks = preferences.cuisines.length > 0
    ? allRestaurants.filter(r => preferences.cuisines.includes(r.cuisine)).slice(0, 5)
    : allRestaurants.slice(0, 5);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const handleEatNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/swipe' as never);
  }, [router]);

  const handlePlanLater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/plan-event' as never);
  }, [router]);

  const handleGroupSwipe = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/group-session' as never);
  }, [router]);

  useEffect(() => {
    if (!isLoading && isOnboarded) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [isOnboarded, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <Redirect href={isAuthenticated ? '/onboarding' as never : '/auth' as never} />;
  }

  const displayName = user?.name || preferences.name;
  const firstName = displayName.split(' ')[0] || 'there';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.greeting}>
            <Text style={[styles.greetingText, { color: Colors.text }]}>Hey {firstName} 👋</Text>
            <Text style={[styles.greetingSubtext, { color: Colors.textSecondary }]}>Where are we eating?</Text>
          </View>

          {locationPermission === 'denied' && (
            <Pressable
              style={[styles.locationBanner, { backgroundColor: Colors.card, borderColor: Colors.border }]}
              onPress={() => Platform.OS === 'web' ? requestLocation() : openSettings()}
              accessibilityLabel="Enable location access"
              accessibilityRole="button"
            >
              <MapPin size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.locationBannerTitle, { color: Colors.text }]}>Enable Location</Text>
                <Text style={[styles.locationBannerSub, { color: Colors.textSecondary }]}>Get personalized nearby restaurant picks</Text>
              </View>
              <ChevronRight size={16} color={Colors.textTertiary} />
            </Pressable>
          )}

          <View style={styles.quickActions}>
            <Pressable
              style={styles.eatNowBtn}
              onPress={handleEatNow}
              testID="eat-now-btn"
            >
              <View style={styles.eatNowInner}>
                <Heart size={22} color="#FFF" fill="#FFF" />
                <View>
                  <Text style={styles.eatNowTitle}>Swipe</Text>
                  <Text style={styles.eatNowSub}>Find your next spot</Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              style={[styles.planLaterBtn, { backgroundColor: Colors.card, borderColor: Colors.primaryLight }]}
              onPress={handlePlanLater}
              testID="plan-later-btn"
            >
              <View style={styles.planLaterInner}>
                <CalendarPlus size={22} color={Colors.primary} />
                <View>
                  <Text style={[styles.planLaterTitle, { color: Colors.text }]}>Plan Event</Text>
                  <Text style={[styles.planLaterSub, { color: Colors.textSecondary }]}>Schedule dining</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <Pressable
            style={[styles.groupSwipeBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]}
            onPress={handleGroupSwipe}
            testID="group-swipe-btn"
          >
            <View style={styles.groupSwipeInner}>
              <View style={[styles.groupSwipeIcon, { backgroundColor: Colors.text }]}>
                <Users size={20} color={Colors.background} />
              </View>
              <View style={styles.groupSwipeText}>
                <Text style={[styles.groupSwipeTitle, { color: Colors.text }]}>Group Swipe</Text>
                <Text style={[styles.groupSwipeSub, { color: Colors.textSecondary }]}>Swipe together, decide as a group</Text>
              </View>
              <ChevronRight size={18} color={Colors.textTertiary} />
            </View>
          </Pressable>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={18} color={Colors.primary} />
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Tonight Near You</Text>
              </View>
              <Pressable style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/discover')}>
                <Text style={[styles.seeAllText, { color: Colors.primary }]}>See all</Text>
                <ChevronRight size={14} color={Colors.primary} />
              </Pressable>
            </View>
            {tonightNearYou.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={tonightNearYou}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <RestaurantCard restaurant={item} variant="horizontal" />}
                contentContainerStyle={styles.horizontalList}
              />
            ) : (
              <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>No restaurants found nearby</Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Flame size={18} color={Colors.error} />
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Last Call Deals</Text>
              </View>
              <Pressable style={styles.seeAllBtn} onPress={() => router.push('/(tabs)/discover?filter=deals' as never)}>
                <Text style={[styles.seeAllText, { color: Colors.primary }]}>See all</Text>
                <ChevronRight size={14} color={Colors.primary} />
              </Pressable>
            </View>
            {lastCallDeals.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={lastCallDeals}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <RestaurantCard restaurant={item} variant="horizontal" />}
                contentContainerStyle={styles.horizontalList}
              />
            ) : (
              <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>No deals right now</Text>
            )}
          </View>

          {closingSoon.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Clock size={18} color={Colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: Colors.text }]}>Closing Soon</Text>
                </View>
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={closingSoon}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <RestaurantCard restaurant={item} variant="horizontal" />}
                contentContainerStyle={styles.horizontalList}
              />
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <TrendingUp size={18} color={Colors.success} />
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Popular Nearby</Text>
              </View>
            </View>
            {trendingWithFriends.length > 0 ? (
              trendingWithFriends.map(r => (
                <RestaurantCard key={r.id} restaurant={r} variant="compact" />
              ))
            ) : (
              <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>No popular spots found</Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={18} color={Colors.secondary} />
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>Based on Your Picks</Text>
              </View>
            </View>
            {basedOnPastPicks.length > 0 ? (
              basedOnPastPicks.map(r => (
                <RestaurantCard key={r.id} restaurant={r} variant="compact" />
              ))
            ) : (
              <Text style={[styles.emptyText, { color: Colors.textSecondary }]}>No recommendations yet</Text>
            )}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  greeting: {
    marginTop: 16,
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  greetingSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  locationBannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  groupSwipeBtn: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  groupSwipeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupSwipeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2D2D3F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSwipeText: {
    flex: 1,
  },
  groupSwipeTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  groupSwipeSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  eatNowBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  eatNowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eatNowTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  eatNowSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  planLaterBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planLaterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planLaterTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  planLaterSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  horizontalList: {
    paddingRight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
