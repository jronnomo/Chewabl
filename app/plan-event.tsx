import React, { useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { X, CalendarDays, Clock, MapPin, UtensilsCrossed, DollarSign, Users, Sparkles, UserCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CUISINES, BUDGET_OPTIONS, restaurants } from '../mocks/restaurants';
import { DiningPlan } from '../types';
import { getFriends } from '../services/friends';
import { createPlan } from '../services/plans';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

const TIME_OPTIONS = [
  '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM',
];

const today = new Date();
const DATE_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() + i);
  const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'short' });
  const value = d.toISOString().split('T')[0];
  return { label, value };
});

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
  const { addPlan } = useApp();
  const { isAuthenticated } = useAuth();

  const [title, setTitle] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(DATE_OPTIONS[0].value);
  const [allowCurveball, setAllowCurveball] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('7:00 PM');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [selectedBudget, setSelectedBudget] = useState<string>('$$');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [rsvpHours, setRsvpHours] = useState<number | null>(24);
  const [loading, setLoading] = useState(false);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    enabled: isAuthenticated,
  });

  const toggleFriend = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedFriendIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your dining plan a name');
      return;
    }

    setLoading(true);

    try {
      const suggestedOptions = restaurants
        .filter(r => {
          const matchesCuisine = !selectedCuisine || r.cuisine === selectedCuisine;
          const matchesBudget = '$'.repeat(r.priceLevel) === selectedBudget;
          return matchesCuisine || matchesBudget;
        })
        .slice(0, 3);

      let rsvpDeadline: string | undefined;
      if (rsvpHours !== null) {
        const dl = new Date();
        dl.setHours(dl.getHours() + rsvpHours);
        rsvpDeadline = dl.toISOString();
      }

      let planId: string;
      if (isAuthenticated && selectedFriendIds.length > 0) {
        // Use backend
        const plan = await createPlan({
          title: title.trim(),
          date: selectedDate,
          time: selectedTime,
          cuisine: selectedCuisine || 'Any',
          budget: selectedBudget,
          inviteeIds: selectedFriendIds,
          rsvpDeadline,
          options: suggestedOptions.map(r => r.id),
        });
        // Merge options for local display
        const localPlan: DiningPlan = {
          ...plan,
          invitees: [],
          options: suggestedOptions,
        };
        addPlan(localPlan);
        planId = plan.id;
      } else {
        const newPlan: DiningPlan = {
          id: `p${Date.now()}`,
          title: title.trim(),
          date: selectedDate,
          time: selectedTime,
          status: 'voting',
          cuisine: selectedCuisine || 'Any',
          budget: selectedBudget,
          invitees: [],
          invites: [],
          rsvpDeadline,
          options: suggestedOptions,
          votes: {},
          createdAt: new Date().toISOString().split('T')[0],
        };
        addPlan(newPlan);
        planId = newPlan.id;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Plan Created!',
        'Start a Group Swipe session now?',
        [
          { text: 'Later', onPress: () => router.back() },
          {
            text: 'Start Swipe',
            onPress: () => router.replace(`/group-session?planId=${planId}&curveball=${allowCurveball}` as never),
          },
        ]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create plan';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [title, selectedDate, selectedTime, selectedCuisine, selectedBudget, selectedFriendIds, rsvpHours, isAuthenticated, addPlan, router, allowCurveball]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerHandle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>New Dining Plan</Text>
            <Pressable style={styles.closeBtn} onPress={() => router.back()}>
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
            <Text style={styles.label}>Plan Name</Text>
            <TextInput
              style={styles.input}
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
              <Text style={styles.label}>Date</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {DATE_OPTIONS.map(d => (
                  <Pressable
                    key={d.value}
                    style={[styles.dateChip, selectedDate === d.value && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedDate(d.value); }}
                  >
                    <Text style={[styles.dateChipText, selectedDate === d.value && styles.chipTextActive]}>
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
              <Text style={styles.label}>Time</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {TIME_OPTIONS.map(t => (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, selectedTime === t && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedTime(t); }}
                  >
                    <Text style={[styles.timeChipText, selectedTime === t && styles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <UtensilsCrossed size={16} color={Colors.primary} />
              <Text style={styles.label}>Cuisine Vibe</Text>
            </View>
            <View style={styles.wrapRow}>
              <Pressable
                style={[styles.cuisineChip, !selectedCuisine && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setSelectedCuisine(''); }}
              >
                <Text style={[styles.cuisineChipText, !selectedCuisine && styles.chipTextActive]}>Any</Text>
              </Pressable>
              {CUISINES.slice(0, 8).map(c => (
                <Pressable
                  key={c}
                  style={[styles.cuisineChip, selectedCuisine === c && styles.chipActive]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCuisine(c); }}
                >
                  <Text style={[styles.cuisineChipText, selectedCuisine === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <DollarSign size={16} color={Colors.primary} />
              <Text style={styles.label}>Budget</Text>
            </View>
            <View style={styles.budgetRow}>
              {BUDGET_OPTIONS.map(b => (
                <Pressable
                  key={b}
                  style={[styles.budgetChip, selectedBudget === b && styles.chipActive]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedBudget(b); }}
                >
                  <Text style={[styles.budgetChipText, selectedBudget === b && styles.chipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
              <View style={styles.labelRow}>
                <Sparkles size={16} color={Colors.secondary} />
                <Text style={styles.label}>Allow Curveball Deals 🎲</Text>
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

          {isAuthenticated && friends.length > 0 && (
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <UserCheck size={16} color={Colors.primary} />
                <Text style={styles.label}>Invite Friends</Text>
              </View>
              <View style={styles.wrapRow}>
                {friends.map(f => {
                  const selected = selectedFriendIds.includes(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.friendChip, selected && styles.chipActive]}
                      onPress={() => toggleFriend(f.id)}
                    >
                      {f.avatarUri ? (
                        <Image source={{ uri: f.avatarUri }} style={styles.friendChipAvatar} contentFit="cover" />
                      ) : (
                        <View style={styles.friendChipAvatarFallback}>
                          <Text style={[styles.friendChipInitial, selected && { color: '#FFF' }]}>
                            {f.name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.friendChipText, selected && styles.chipTextActive]}>
                        {f.name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {isAuthenticated && (
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <MapPin size={16} color={Colors.primary} />
                <Text style={styles.label}>RSVP Deadline</Text>
              </View>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.timeChip, rsvpHours === null && styles.chipActive]}
                  onPress={() => { Haptics.selectionAsync(); setRsvpHours(null); }}
                >
                  <Text style={[styles.timeChipText, rsvpHours === null && styles.chipTextActive]}>None</Text>
                </Pressable>
                {RSVP_DEADLINE_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.hours}
                    style={[styles.timeChip, rsvpHours === opt.hours && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setRsvpHours(opt.hours); }}
                  >
                    <Text style={[styles.timeChipText, rsvpHours === opt.hours && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <Sparkles size={18} color={Colors.secondary} />
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>Smart Suggestions</Text>
              <Text style={styles.infoCardText}>
                We'll suggest 3-5 curated restaurants based on your preferences. Friends can vote on their favorites!
              </Text>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.createBtn, (!title.trim() || loading) && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || loading}
            testID="create-plan-btn"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.createBtnText}>Create Plan</Text>
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
  friendChipAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendChipInitial: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  friendChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
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
