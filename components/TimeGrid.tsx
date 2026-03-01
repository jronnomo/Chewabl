import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { Coffee, Sun, Sunset, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MEAL_PERIODS, parseTimeToMinutes } from '../constants/mealPeriods';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

interface TimeGridProps {
  selectedTime: string;
  onSelectTime: (time: string) => void;
  selectedDate: string;
}

const PERIOD_ICONS = {
  coffee: Coffee,
  sun: Sun,
  sunset: Sunset,
  moon: Moon,
} as const;

export default function TimeGrid({ selectedTime, onSelectTime, selectedDate }: TimeGridProps) {
  const Colors = useColors();

  // One animated value per period for staggered mount animation
  const periodAnims = useRef(MEAL_PERIODS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(8),
  }))).current;

  // Map of time -> Animated.Value for scale pulse on selection
  const chipScaleAnims = useRef<Record<string, Animated.Value>>({}).current;
  const ensureChipAnim = (time: string) => {
    if (!chipScaleAnims[time]) {
      chipScaleAnims[time] = new Animated.Value(1);
    }
    return chipScaleAnims[time];
  };

  // Compute which times are disabled (past times when date is today)
  const disabledTimes = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedDate !== todayStr) return new Set<string>();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const disabled = new Set<string>();
    for (const period of MEAL_PERIODS) {
      for (const time of period.times) {
        if (parseTimeToMinutes(time) <= currentMinutes) {
          disabled.add(time);
        }
      }
    }
    return disabled;
  }, [selectedDate]);

  // Staggered mount animation
  useEffect(() => {
    const animations = periodAnims.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 200,
          delay: index * 50,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 200,
          delay: index * 50,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, [periodAnims]);

  const handleChipPress = (time: string, isDisabled: boolean) => {
    if (isDisabled) return;
    Haptics.selectionAsync();
    onSelectTime(time);
    const scaleAnim = ensureChipAnim(time);
    Animated.spring(scaleAnim, {
      toValue: 1.08,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <View style={styles.container}>
      {MEAL_PERIODS.map((period, periodIndex) => {
        const anim = periodAnims[periodIndex];
        const Icon = PERIOD_ICONS[period.icon];

        return (
          <Animated.View
            key={period.name}
            style={[
              styles.periodSection,
              periodIndex > 0 && styles.periodSectionGap,
              {
                opacity: anim.opacity,
                transform: [{ translateY: anim.translateY }],
              },
            ]}
          >
            {/* Period header */}
            <View style={styles.periodHeader}>
              <Icon size={14} color={Colors.textSecondary} />
              <Text style={[styles.periodLabel, { color: Colors.textSecondary }]}>
                {period.name}
              </Text>
            </View>

            {/* Time chips grid */}
            <View style={styles.chipsGrid}>
              {period.times.map((time) => {
                const isSelected = selectedTime === time;
                const isDisabled = disabledTimes.has(time);
                const scaleAnim = ensureChipAnim(time);

                return (
                  <Animated.View
                    key={time}
                    style={[
                      styles.chipWrapper,
                      { transform: [{ scale: scaleAnim }] },
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.chip,
                        { backgroundColor: Colors.card, borderColor: Colors.border },
                        isSelected && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                        isDisabled && styles.chipDisabled,
                      ]}
                      onPress={() => handleChipPress(time, isDisabled)}
                      disabled={isDisabled}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: Colors.text },
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {time}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // no gap here; periods add their own gap via periodSectionGap
  },
  periodSection: {
    // base section — no extra margin (first one)
  },
  periodSectionGap: {
    marginTop: 16,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipWrapper: {
    // 3 chips per row with gap: calc so each is ~(screenWidth - 2*paddingH - 2*gap) / 3
    // Use minWidth to approximate — parent is inside ScrollView with paddingHorizontal 20
    // 3 chips per row: (full width - 40px padding - 16px total gap) / 3
    // We'll use flex basis approach: width ~106pt
    minWidth: 96,
    flex: 1,
    maxWidth: '33%',
  },
  chip: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextSelected: {
    color: '#FFF',
  },
});
