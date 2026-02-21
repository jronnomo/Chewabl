import React, { useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Star,
  MapPin,
  Phone,
  Clock,
  Users,
  Volume2,
  ChefHat,
  Flame,
  Share2,
  Navigation,
  CalendarPlus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { restaurants } from '../../mocks/restaurants';
import { getRegisteredRestaurant } from '../../lib/restaurantRegistry';
import { useApp } from '../../context/AppContext';
import Colors from '../../constants/colors';

export default function RestaurantDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { favorites, toggleFavorite } = useApp();
  const heartScale = useRef(new Animated.Value(1)).current;

  const restaurant = useMemo(
    () => getRegisteredRestaurant(id ?? '') ?? restaurants.find(r => r.id === id),
    [id]
  );

  const isFavorite = restaurant ? favorites.includes(restaurant.id) : false;

  const handleFavorite = useCallback(() => {
    if (!restaurant) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    toggleFavorite(restaurant.id);
  }, [restaurant, toggleFavorite, heartScale]);

  const handleCall = useCallback(() => {
    if (!restaurant) return;
    Linking.openURL(`tel:${restaurant.phone}`);
  }, [restaurant]);

  const handleDirections = useCallback(() => {
    if (!restaurant) return;
    Alert.alert('Directions', `Navigate to ${restaurant.address}`);
  }, [restaurant]);

  const handlePlanEvent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/plan-event?restaurantId=${id}` as never);
  }, [router, id]);

  if (!restaurant) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Restaurant not found</Text>
      </View>
    );
  }

  const priceString = '$'.repeat(restaurant.priceLevel);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.heroContainer}>
          <Image source={{ uri: restaurant.imageUrl }} style={styles.heroImage} contentFit="cover" />
          <View style={styles.heroOverlay} />

          <View style={[styles.heroActions, { top: insets.top + 8 }]}>
            <Pressable style={styles.heroBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#FFF" />
            </Pressable>
            <View style={styles.heroActionsRight}>
              <Pressable style={styles.heroBtn} onPress={() => Alert.alert('Share', 'Sharing coming soon!')}>
                <Share2 size={18} color="#FFF" />
              </Pressable>
              <Pressable style={styles.heroBtn} onPress={handleFavorite}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Heart size={20} color="#FFF" fill={isFavorite ? Colors.primary : 'transparent'} />
                </Animated.View>
              </Pressable>
            </View>
          </View>

          {restaurant.lastCallDeal && (
            <View style={styles.heroDeal}>
              <Flame size={14} color="#FFF" />
              <Text style={styles.heroDealText}>{restaurant.lastCallDeal}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.name}>{restaurant.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.cuisine}>{restaurant.cuisine}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.price}>{priceString}</Text>
              <View style={styles.metaDot} />
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.distance}>{restaurant.distance}</Text>
            </View>
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingMain}>
              <Star size={22} color={Colors.star} fill={Colors.star} />
              <Text style={styles.ratingValue}>{restaurant.rating}</Text>
              <Text style={styles.reviewCount}>({restaurant.reviewCount} reviews)</Text>
            </View>
            <View style={styles.ratingDetails}>
              <InfoPill icon={Volume2} label={restaurant.noiseLevel} />
              <InfoPill icon={Users} label={restaurant.seating.join(' & ')} />
              <InfoPill
                icon={Clock}
                label={restaurant.busyLevel === 'busy' ? 'Busy now' : restaurant.busyLevel === 'moderate' ? 'Moderate' : 'Not busy'}
              />
            </View>
          </View>

          <Text style={styles.description}>{restaurant.description}</Text>

          <View style={styles.quickActions}>
            <Pressable style={styles.actionBtn} onPress={handleCall}>
              <Phone size={18} color={Colors.primary} />
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleDirections}>
              <Navigation size={18} color={Colors.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handlePlanEvent}>
              <CalendarPlus size={18} color={Colors.primary} />
              <Text style={styles.actionText}>Plan</Text>
            </Pressable>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.infoCard}>
              <DetailRow icon={MapPin} label="Address" value={restaurant.address} />
              <View style={styles.infoDivider} />
              <DetailRow icon={Clock} label="Hours" value={restaurant.hours} />
              <View style={styles.infoDivider} />
              <DetailRow icon={Phone} label="Phone" value={restaurant.phone} />
              <View style={styles.infoDivider} />
              <DetailRow icon={ChefHat} label="Tags" value={restaurant.tags.join(', ')} />
            </View>
          </View>

          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {restaurant.photos.map((photo, idx) => (
                <Image key={idx} source={{ uri: photo }} style={styles.photoThumb} contentFit="cover" />
              ))}
            </ScrollView>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {restaurant.isOpenNow && (
          <View style={styles.openIndicator}>
            <View style={styles.openDot} />
            <Text style={styles.openLabel}>Open Now</Text>
          </View>
        )}
        <Pressable
          style={styles.reserveBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Reserve', restaurant.hasReservation ? 'Opening reservation...' : 'This restaurant does not take reservations.');
          }}
          testID="reserve-btn"
        >
          <Text style={styles.reserveBtnText}>
            {restaurant.hasReservation ? 'Reserve a Table' : 'Contact Restaurant'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <View style={styles.infoPill}>
      <Icon size={13} color={Colors.textSecondary} />
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconCircle}>
        <Icon size={14} color={Colors.primary} />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  heroContainer: {
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  heroActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroActionsRight: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDeal: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
  },
  heroDealText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
  },
  titleSection: {
    marginBottom: 16,
  },
  name: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  cuisine: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
  price: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  distance: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  ratingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ratingValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  reviewCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  ratingDetails: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  infoPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'capitalize' as const,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 56,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  detailIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 1,
  },
  photosSection: {
    marginBottom: 20,
  },
  photoThumb: {
    width: 140,
    height: 100,
    borderRadius: 12,
    marginRight: 10,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  openIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  openLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  reserveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  reserveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
