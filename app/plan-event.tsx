import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { X, CalendarDays, Clock, MapPin, UtensilsCrossed, DollarSign, Users, Sparkles, UserCheck, Timer } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp, useNearbyRestaurants } from '../context/AppContext';
import RestaurantCountSlider from '../components/RestaurantCountSlider';
import { useAuth } from '../context/AuthContext';
import { CUISINES, BUDGET_OPTIONS, restaurants } from '../mocks/restaurants';
import { getRegisteredRestaurant } from '../lib/restaurantRegistry';
import { DiningPlan } from '../types';
import { getFriends } from '../services/friends';
import { createPlan, updatePlan } from '../services/plans';
import StaticColors from '../constants/colors';
import { DEFAULT_AVATAR_URI } from '../constants/images';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

const TIME_OPTIONS = [
  '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM',
];

function buildDateOptions() {
  const today = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short' });
    const value = d.toISOString().split('T')[0];
    return { label, value };
  });
}

const RSVP_DEADLINE_OPTIONS = [
  { label: '12 hrs', hours: 12 },
  { label: '1 day', hours: 24 },
  { label: '2 days', hours: 48 },
  { label: '3 days', hours: 72 },
];

export default function PlanEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const { addPlan, plans } = useApp();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: nearbyRestaurants = [] } = useNearbyRestaurants();
  const { restaurantId, planId } = useLocalSearchParams<{ restaurantId?: string; planId?: string }>();

  const existingPlan = planId ? plans.find(p => p.id === planId) : undefined;

  const pinnedRestaurant = restaurantId
    ? (getRegisteredRestaurant(restaurantId) ?? restaurants.find(r => r.id === restaurantId))
    : undefined;

  // Recompute date options each time the screen mounts (avoids stale "Today" past midnight)
  const DATE_OPTIONS = useMemo(() => buildDateOptions(), []);
  const submittingRef = useRef(false);

  const [title, setTitle] = useState<string>(existingPlan?.title ?? '');
  const [selectedDate, setSelectedDate] = useState<string>(() => existingPlan?.date ?? buildDateOptions()[0].value);
  const [allowCurveball, setAllowCurveball] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>(existingPlan?.time ?? '7:00 PM');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(
    existingPlan?.cuisine && existingPlan.cuisine !== 'Any' ? existingPlan.cuisine.split(', ') : []
  );
  const [selectedBudget, setSelectedBudget] = useState<string>(existingPlan?.budget ?? '$$');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(
    existingPlan?.invites?.map(i => i.userId) ?? []
  );
  const [rsvpHours, setRsvpHours] = useState<number>(24);
  const [restaurantCount, setRestaurantCount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const isEditMode = !!existingPlan;

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const toggleCuisine = useCallback((cuisine: string) => {
    Haptics.selectionAsync();
    setSelectedCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  }, []);

  const toggleFriend = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedFriendIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    // Prevent double-tap: ref check is synchronous, catches rapid taps before re-render
    if (submittingRef.current) return;
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your dining plan a name');
      return;
    }

    // Validate that the RSVP deadline falls before the event date+time
    if (rsvpHours !== null) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + rsvpHours);

      const [year, month, day] = selectedDate.split('-').map(Number);
      const timeMatch = selectedTime.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        const isPM = timeMatch[3].toUpperCase() === 'PM';
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        const eventDateTime = new Date(year, month - 1, day, h, m);

        if (deadline >= eventDateTime) {
          Alert.alert(
            'Invalid RSVP Deadline',
            'The RSVP deadline must be before the event starts. Choose a shorter deadline or a later event date.'
          );
          return;
        }
      }
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const effectiveCuisine = pinnedRestaurant
        ? pinnedRestaurant.cuisine
        : selectedCuisines.length > 0 ? selectedCuisines.join(', ') : 'Any';
      const effectiveBudget = pinnedRestaurant ? '$'.repeat(pinnedRestaurant.priceLevel) : selectedBudget;

      // Use Google Places results if available, otherwise fall back to mock data
      const restaurantPool = nearbyRestaurants.length > 0 ? nearbyRestaurants : restaurants;
      const suggestedOptions = pinnedRestaurant
        ? [pinnedRestaurant]
        : restaurantPool
            .filter(r => {
              const matchesCuisine = selectedCuisines.length === 0 || selectedCuisines.includes(r.cuisine);
              const matchesBudget = '$'.repeat(r.priceLevel) === selectedBudget;
              return matchesCuisine || matchesBudget;
            })
            .slice(0, restaurantCount);

      let rsvpDeadline: string | undefined;
      if (rsvpHours) {
        const dl = new Date();
        dl.setHours(dl.getHours() + rsvpHours);
        rsvpDeadline = dl.toISOString();
      }

      let resultPlanId: string;
      if (isAuthenticated) {
        const restaurantPayload = pinnedRestaurant ? {
          id: pinnedRestaurant.id,
          name: pinnedRestaurant.name,
          imageUrl: pinnedRestaurant.imageUrl,
          address: pinnedRestaurant.address,
          cuisine: pinnedRestaurant.cuisine,
          priceLevel: pinnedRestaurant.priceLevel,
          rating: pinnedRestaurant.rating,
        } : undefined;
        const payload = {
          title: title.trim(),
          date: selectedDate,
          time: selectedTime,
          cuisine: effectiveCuisine,
          budget: effectiveBudget,
          restaurant: restaurantPayload,
          inviteeIds: selectedFriendIds,
          rsvpDeadline,
          options: suggestedOptions.map(r => r.id),
          restaurantOptions: suggestedOptions,
          restaurantCount,
          allowCurveball,
        };
        let plan: DiningPlan;
        if (isEditMode && existingPlan) {
          plan = await updatePlan(existingPlan.id, payload);
        } else {
          plan = await createPlan(payload);
        }
        // Merge options for local display
        const localPlan: DiningPlan = {
          ...plan,
          invitees: [],
          options: suggestedOptions,
        };
        if (!isEditMode) {
          addPlan(localPlan);
        }
        resultPlanId = plan.id;
      } else {
        const newPlan: DiningPlan = {
          id: `p${Date.now()}`,
          title: title.trim(),
          date: selectedDate,
          time: selectedTime,
          status: pinnedRestaurant ? 'confirmed' : 'voting',
          restaurant: pinnedRestaurant ?? undefined,
          cuisine: effectiveCuisine,
          budget: effectiveBudget,
          invitees: [],
          invites: [],
          rsvpDeadline,
          options: suggestedOptions,
          votes: {},
          createdAt: new Date().toISOString().split('T')[0],
        };
        addPlan(newPlan);
        resultPlanId = newPlan.id;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // F-005-027: In edit mode, invalidate cache and navigate back
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['plans'] });
        router.back();
      } else if (pinnedRestaurant) {
        // Restaurant already selected — skip lobby, go straight to swiping
        router.replace(`/group-session?planId=${resultPlanId}&autoStart=true` as never);
      } else {
        Alert.alert(
          'Plan Created!',
          'Invites sent! Voting will open after your RSVP deadline.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create plan';
      Alert.alert('Error', msg);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [title, selectedDate, selectedTime, selectedCuisines, selectedBudget, selectedFriendIds, rsvpHours, restaurantCount, isAuthenticated, isEditMode, existingPlan, addPlan, router, allowCurveball, pinnedRestaurant]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={styles.header}>
          <View style={[styles.headerHandle, { backgroundColor: Colors.border }]} />
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: Colors.text }]}>{isEditMode ? 'Edit Plan' : 'New Dining Plan'}</Text>
            <Pressable style={[styles.closeBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} accessibilityLabel="Close" accessibilityRole="button">
              <X size={20} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: Colors.text }]}>Plan Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: Colors.card, borderColor: Colors.border, color: Colors.text }]}
              placeholder="e.g. Friday Night Dinner"
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              testID="plan-title-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <CalendarDays size={16} color={Colors.primary} />
              <Text style={[styles.label, { color: Colors.text }]}>Date</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {DATE_OPTIONS.map(d => (
                  <Pressable
                    key={d.value}
                    style={[styles.dateChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selectedDate === d.value && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedDate(d.value); }}
                  >
                    <Text style={[styles.dateChipText, { color: Colors.text }, selectedDate === d.value && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Clock size={16} color={Colors.primary} />
              <Text style={[styles.label, { color: Colors.text }]}>Time</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map(t => (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selectedTime === t && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedTime(t); }}
                  >
                    <Text style={[styles.timeChipText, { color: Colors.text }, selectedTime === t && styles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {pinnedRestaurant ? (
            <View style={[styles.pinnedCard, { backgroundColor: Colors.card, borderColor: Colors.primary }]}>
              <Image source={{ uri: pinnedRestaurant.imageUrl }} style={styles.pinnedImage} contentFit="cover" />
              <View style={styles.pinnedInfo}>
                <Text style={[styles.pinnedLabel, { color: Colors.primary }]}>Restaurant</Text>
                <Text style={[styles.pinnedName, { color: Colors.text }]}>{pinnedRestaurant.name}</Text>
                <Text style={[styles.pinnedMeta, { color: Colors.textSecondary }]}>
                  {pinnedRestaurant.cuisine} · {'$'.repeat(pinnedRestaurant.priceLevel)} · {pinnedRestaurant.distance}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <UtensilsCrossed size={16} color={Colors.primary} />
                  <Text style={[styles.label, { color: Colors.text }]}>Cuisine Vibe</Text>
                </View>
                <View style={styles.wrapRow}>
                  <Pressable
                    style={[styles.cuisineChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selectedCuisines.length === 0 && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedCuisines([]); }}
                  >
                    <Text style={[styles.cuisineChipText, { color: Colors.text }, selectedCuisines.length === 0 && styles.chipTextActive]}>Any</Text>
                  </Pressable>
                  {CUISINES.slice(0, 8).map(c => (
                    <Pressable
                      key={c}
                      style={[styles.cuisineChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selectedCuisines.includes(c) && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                      onPress={() => toggleCuisine(c)}
                    >
                      <Text style={[styles.cuisineChipText, { color: Colors.text }, selectedCuisines.includes(c) && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <DollarSign size={16} color={Colors.primary} />
                  <Text style={[styles.label, { color: Colors.text }]}>Budget</Text>
                </View>
                <View style={styles.budgetRow}>
                  {BUDGET_OPTIONS.map(b => (
                    <Pressable
                      key={b}
                      style={[styles.budgetChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selectedBudget === b && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                      onPress={() => { Haptics.selectionAsync(); setSelectedBudget(b); }}
                    >
                      <Text style={[styles.budgetChipText, { color: Colors.text }, selectedBudget === b && styles.chipTextActive]}>{b}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <RestaurantCountSlider value={restaurantCount} onValueChange={setRestaurantCount} />
              </View>

              <View style={styles.inputGroup}>
                <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                  <View style={styles.labelRow}>
                    <Sparkles size={16} color={Colors.secondary} />
                    <Text style={[styles.label, { color: Colors.text }]}>Allow Curveball Deals 🎲</Text>
                  </View>
                  <Switch
                    value={allowCurveball}
                    onValueChange={(v) => { Haptics.selectionAsync(); setAllowCurveball(v); }}
                    trackColor={{ false: StaticColors.border, true: Colors.secondary }}
                    thumbColor="#FFF"
                  />
                </View>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>
                  Include off-cuisine restaurants with active deals
                </Text>
              </View>
            </>
          )}

          {friends.length > 0 && (
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <UserCheck size={16} color={Colors.primary} />
                <Text style={[styles.label, { color: Colors.text }]}>Invite Friends</Text>
              </View>
              <View style={styles.wrapRow}>
                {friends.map(f => {
                  const selected = selectedFriendIds.includes(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.friendChip, { backgroundColor: Colors.card, borderColor: Colors.border }, selected && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                      onPress={() => toggleFriend(f.id)}
                    >
                      <Image source={f.avatarUri || DEFAULT_AVATAR_URI} style={styles.friendChipAvatar} contentFit="cover" />
                      <Text style={[styles.friendChipText, { color: Colors.text }, selected && styles.chipTextActive]}>
                        {f.name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Timer size={16} color={Colors.primary} />
              <Text style={[styles.label, { color: Colors.text }]}>RSVP Deadline</Text>
            </View>
              <View style={styles.chipRow}>
                {RSVP_DEADLINE_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.hours}
                    style={[styles.timeChip, { backgroundColor: Colors.card, borderColor: Colors.border }, rsvpHours === opt.hours && [styles.chipActive, { backgroundColor: Colors.primary, borderColor: Colors.primary }]]}
                    onPress={() => { Haptics.selectionAsync(); setRsvpHours(opt.hours); }}
                  >
                    <Text style={[styles.timeChipText, { color: Colors.text }, rsvpHours === opt.hours && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: Colors.secondaryLight }]}>
            <Sparkles size={18} color={Colors.secondary} />
            <View style={styles.infoCardContent}>
              <Text style={[styles.infoCardTitle, { color: Colors.text }]}>
                {pinnedRestaurant ? 'Restaurant Locked In' : 'Smart Suggestions'}
              </Text>
              <Text style={[styles.infoCardText, { color: Colors.textSecondary }]}>
                {pinnedRestaurant
                  ? `This plan is set for ${pinnedRestaurant.name}. Invite friends and pick a time that works for everyone!`
                  : "We'll suggest 3-5 curated restaurants based on your preferences. Friends can vote on their favorites!"}
              </Text>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: Colors.card, borderTopColor: Colors.borderLight }]}>
          <Pressable
            style={[styles.createBtn, (!title.trim() || loading) && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || loading}
            testID="create-plan-btn"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.createBtnText}>{isEditMode ? 'Update Plan' : 'Create Plan'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  headerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 8,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 0,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cuisineChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cuisineChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  budgetChipText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  friendChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  friendChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pinnedCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  pinnedImage: {
    width: 90,
    height: 90,
  },
  pinnedInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 2,
  },
  pinnedLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  pinnedName: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  pinnedMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.secondaryLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
