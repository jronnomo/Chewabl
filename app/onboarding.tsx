import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, ChevronLeft, Utensils } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../context/AppContext';
import { CUISINES, BUDGET_OPTIONS, DIETARY_OPTIONS, ATMOSPHERE_OPTIONS, GROUP_SIZE_OPTIONS } from '../mocks/restaurants';
import { UserPreferences } from '../types';
import Colors from '../constants/colors';

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveOnboarding } = useApp();
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>('$$');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<string>('Moderate');
  const [selectedGroupSize, setSelectedGroupSize] = useState<string>('2');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = useCallback((direction: 'forward' | 'back', callback: () => void) => {
    const outValue = direction === 'forward' ? -30 : 30;
    const inValue = direction === 'forward' ? 30 : -30;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: outValue, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(inValue);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) {
      animateTransition('forward', () => setStep(s => s + 1));
    } else {
      const prefs: UserPreferences = {
        name,
        cuisines: selectedCuisines,
        budget: selectedBudget,
        dietary: selectedDietary,
        atmosphere: selectedAtmosphere,
        groupSize: selectedGroupSize,
      };
      saveOnboarding.mutate(prefs, {
        onSuccess: () => {
          router.replace('/' as never);
        },
      });
    }
  }, [step, name, selectedCuisines, selectedBudget, selectedDietary, selectedAtmosphere, selectedGroupSize, saveOnboarding, router, animateTransition]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 0) {
      animateTransition('back', () => setStep(s => s - 1));
    }
  }, [step, animateTransition]);

  const toggleCuisine = useCallback((c: string) => {
    Haptics.selectionAsync();
    setSelectedCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }, []);

  const toggleDietary = useCallback((d: string) => {
    Haptics.selectionAsync();
    setSelectedDietary(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }, []);

  const canProceed = step === 0 ? name.trim().length > 0 : true;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>👋</Text>
            <Text style={styles.stepTitle}>Welcome to Chewabl</Text>
            <Text style={styles.stepSubtitle}>No more "where should we eat?" — let's get you set up.</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="What's your name?"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus
              testID="onboarding-name-input"
            />
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🍽️</Text>
            <Text style={styles.stepTitle}>What do you love?</Text>
            <Text style={styles.stepSubtitle}>Pick your favorite cuisines (select as many as you like)</Text>
            <View style={styles.optionsGrid}>
              {CUISINES.map(c => (
                <Pressable
                  key={c}
                  style={[styles.optionChip, selectedCuisines.includes(c) && styles.optionChipActive]}
                  onPress={() => toggleCuisine(c)}
                >
                  <Text style={[styles.optionChipText, selectedCuisines.includes(c) && styles.optionChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>💰</Text>
            <Text style={styles.stepTitle}>Your typical budget</Text>
            <Text style={styles.stepSubtitle}>We'll use this to suggest places in your range</Text>
            <View style={styles.budgetRow}>
              {BUDGET_OPTIONS.map(b => (
                <Pressable
                  key={b}
                  style={[styles.budgetChip, selectedBudget === b && styles.budgetChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedBudget(b);
                  }}
                >
                  <Text style={[styles.budgetChipText, selectedBudget === b && styles.budgetChipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.subSectionTitle}>Dietary restrictions</Text>
            <View style={styles.optionsGrid}>
              {DIETARY_OPTIONS.map(d => (
                <Pressable
                  key={d}
                  style={[styles.optionChip, selectedDietary.includes(d) && styles.optionChipActive]}
                  onPress={() => toggleDietary(d)}
                >
                  <Text style={[styles.optionChipText, selectedDietary.includes(d) && styles.optionChipTextActive]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>✨</Text>
            <Text style={styles.stepTitle}>Almost there!</Text>
            <Text style={styles.stepSubtitle}>A few more preferences to personalize your experience</Text>

            <Text style={styles.subSectionTitle}>Vibe preference</Text>
            <View style={styles.optionsGrid}>
              {ATMOSPHERE_OPTIONS.map(a => (
                <Pressable
                  key={a}
                  style={[styles.optionChip, selectedAtmosphere === a && styles.optionChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedAtmosphere(a);
                  }}
                >
                  <Text style={[styles.optionChipText, selectedAtmosphere === a && styles.optionChipTextActive]}>{a}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.subSectionTitle}>Typical group size</Text>
            <View style={styles.optionsGrid}>
              {GROUP_SIZE_OPTIONS.map(g => (
                <Pressable
                  key={g}
                  style={[styles.optionChip, selectedGroupSize === g && styles.optionChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedGroupSize(g);
                  }}
                >
                  <Text style={[styles.optionChipText, selectedGroupSize === g && styles.optionChipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= step && styles.progressDotActive,
                i === step && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomActions}>
          {step > 0 && (
            <Pressable style={styles.backBtn} onPress={handleBack}>
              <ChevronLeft size={20} color={Colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          )}
          <View style={styles.flex} />
          <Pressable
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed}
            testID="onboarding-next-btn"
          >
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS - 1 ? "Let's Eat!" : 'Next'}
            </Text>
            <ChevronRight size={18} color="#FFF" />
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
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    height: 4,
    width: 32,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primaryLight,
  },
  progressDotCurrent: {
    backgroundColor: Colors.primary,
    width: 48,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  stepContent: {
    paddingTop: 20,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  nameInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  optionChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  optionChipTextActive: {
    color: '#FFF',
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  budgetChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  budgetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  budgetChipText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  budgetChipTextActive: {
    color: '#FFF',
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
