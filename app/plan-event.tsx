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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, CalendarDays, Clock, MapPin, UtensilsCrossed, DollarSign, Users, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../context/AppContext';
import { CUISINES, BUDGET_OPTIONS, restaurants } from '../mocks/restaurants';
import { DiningPlan } from '../types';
import Colors from '../constants/colors';

const TIME_OPTIONS = [
  '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM',
];

const DATE_OPTIONS = [
  { label: 'Today', value: '2026-02-20' },
  { label: 'Tomorrow', value: '2026-02-21' },
  { label: 'Sat', value: '2026-02-22' },
  { label: 'Sun', value: '2026-02-23' },
  { label: 'Mon', value: '2026-02-24' },
];

export default function PlanEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addPlan } = useApp();

  const [title, setTitle] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(DATE_OPTIONS[0].value);
  const [selectedTime, setSelectedTime] = useState<string>('7:00 PM');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [selectedBudget, setSelectedBudget] = useState<string>('$$');

  const handleCreate = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your dining plan a name');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const suggestedOptions = restaurants
      .filter(r => {
        const matchesCuisine = !selectedCuisine || r.cuisine === selectedCuisine;
        const matchesBudget = '$'.repeat(r.priceLevel) === selectedBudget;
        return matchesCuisine || matchesBudget;
      })
      .slice(0, 3);

    const newPlan: DiningPlan = {
      id: `p${Date.now()}`,
      title: title.trim(),
      date: selectedDate,
      time: selectedTime,
      status: 'voting',
      cuisine: selectedCuisine || 'Any',
      budget: selectedBudget,
      invitees: [],
      options: suggestedOptions,
      votes: {},
      createdAt: new Date().toISOString().split('T')[0],
    };

    addPlan(newPlan);
    router.back();
  }, [title, selectedDate, selectedTime, selectedCuisine, selectedBudget, addPlan, router]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDate(d.value);
                    }}
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
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedTime(t);
                    }}
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
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCuisine('');
                }}
              >
                <Text style={[styles.cuisineChipText, !selectedCuisine && styles.chipTextActive]}>Any</Text>
              </Pressable>
              {CUISINES.slice(0, 8).map(c => (
                <Pressable
                  key={c}
                  style={[styles.cuisineChip, selectedCuisine === c && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCuisine(c);
                  }}
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
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedBudget(b);
                  }}
                >
                  <Text style={[styles.budgetChipText, selectedBudget === b && styles.chipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>
          </View>

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
            style={[styles.createBtn, !title.trim() && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!title.trim()}
            testID="create-plan-btn"
          >
            <Text style={styles.createBtnText}>Create Plan</Text>
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
