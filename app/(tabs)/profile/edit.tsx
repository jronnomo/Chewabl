import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../../context/AppContext';
import {
  CUISINES,
  BUDGET_OPTIONS,
  DIETARY_OPTIONS,
  DISTANCE_OPTIONS,
} from '../../../mocks/restaurants';
import Colors from '../../../constants/colors';

const ATMOSPHERE_OPTIONS = ['Quiet', 'Moderate', 'Lively'];
const GROUP_SIZE_OPTIONS = ['1', '2', '3-4', '5-6', '7+'];

export default function EditPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, updatePreferences } = useApp();

  const [cuisines, setCuisines] = useState<string[]>(preferences.cuisines);
  const [budget, setBudget] = useState(preferences.budget);
  const [dietary, setDietary] = useState<string[]>(preferences.dietary);
  const [atmosphere, setAtmosphere] = useState(preferences.atmosphere);
  const [groupSize, setGroupSize] = useState(preferences.groupSize);
  const [distance, setDistance] = useState(preferences.distance);

  const toggleCuisine = useCallback((c: string) => {
    Haptics.selectionAsync();
    setCuisines(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }, []);

  const toggleDietary = useCallback((d: string) => {
    Haptics.selectionAsync();
    setDietary(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  }, []);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePreferences.mutate({
      ...preferences,
      cuisines,
      budget,
      dietary,
      atmosphere,
      groupSize,
      distance,
    });
    router.back();
  }, [preferences, cuisines, budget, dietary, atmosphere, groupSize, distance, updatePreferences, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Preferences</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Check size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <Section title="Cuisines" subtitle="Select all you enjoy">
          <View style={styles.wrapRow}>
            {CUISINES.map(c => (
              <Pressable
                key={c}
                style={[styles.chip, cuisines.includes(c) && styles.chipActive]}
                onPress={() => toggleCuisine(c)}
              >
                <Text style={[styles.chipText, cuisines.includes(c) && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Budget">
          <View style={styles.chipRow}>
            {BUDGET_OPTIONS.map(b => (
              <Pressable
                key={b}
                style={[styles.chip, styles.chipFlex, budget === b && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setBudget(b); }}
              >
                <Text style={[styles.chipText, budget === b && styles.chipTextActive]}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Dietary Restrictions">
          <View style={styles.wrapRow}>
            {(DIETARY_OPTIONS as string[]).map(d => (
              <Pressable
                key={d}
                style={[styles.chip, dietary.includes(d) && styles.chipActive]}
                onPress={() => toggleDietary(d)}
              >
                <Text style={[styles.chipText, dietary.includes(d) && styles.chipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Atmosphere">
          <View style={styles.chipRow}>
            {ATMOSPHERE_OPTIONS.map(a => (
              <Pressable
                key={a}
                style={[styles.chip, styles.chipFlex, atmosphere === a && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setAtmosphere(a); }}
              >
                <Text style={[styles.chipText, atmosphere === a && styles.chipTextActive]}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Group Size">
          <View style={styles.chipRow}>
            {GROUP_SIZE_OPTIONS.map(g => (
              <Pressable
                key={g}
                style={[styles.chip, styles.chipFlex, groupSize === g && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setGroupSize(g); }}
              >
                <Text style={[styles.chipText, groupSize === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Max Distance">
          <View style={styles.chipRow}>
            {DISTANCE_OPTIONS.map(d => (
              <Pressable
                key={d}
                style={[styles.chip, styles.chipFlex, distance === d && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setDistance(d); }}
              >
                <Text style={[styles.chipText, distance === d && styles.chipTextActive]}>{d} mi</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      {children}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipFlex: {
    flex: 1,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  chipTextActive: {
    color: '#FFF',
  },
});
