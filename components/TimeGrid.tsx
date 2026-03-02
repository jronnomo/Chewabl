import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, Easing, LayoutAnimation, Platform, StyleSheet, UIManager } from 'react-native';
import { Coffee, Sun, Sunset, Moon, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MEAL_PERIODS, parseTimeToMinutes } from '../constants/mealPeriods';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  // Track which collapsed periods the user has manually expanded
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  // Track which active (default-expanded) periods the user has manually collapsed
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());

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

  const isToday = useMemo(() => {
    return selectedDate === new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  // Compute which times are disabled (past times when date is today)
  const disabledTimes = useMemo(() => {
    if (!isToday) return new Set<string>();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const disabled = new Set<string>();
    for (const period of MEAL_PERIODS) {
      for (const time of period.times) {
        if (parseTimeToMinutes(time) <= currentMinutes + 120) {
          disabled.add(time);
        }
      }
    }
    return disabled;
  }, [isToday]);

  // Compute which periods are fully past (all times disabled)
  const fullyPastPeriods = useMemo(() => {
    const past = new Set<string>();
    if (!isToday) return past;
    for (const period of MEAL_PERIODS) {
      if (period.times.every(t => disabledTimes.has(t))) {
        past.add(period.name);
      }
    }
    return past;
  }, [isToday, disabledTimes]);

  // Determine which period contains the selected time
  const activePeriodName = useMemo(() => {
    if (!selectedTime) return null;
    for (const period of MEAL_PERIODS) {
      if (period.times.includes(selectedTime)) {
        return period.name;
      }
    }
    return null;
  }, [selectedTime]);

  // Reset manual toggle sets when the active period changes (user picked time in different period)
  const prevActivePeriod = useRef(activePeriodName);
  useEffect(() => {
    if (prevActivePeriod.current !== activePeriodName && prevActivePeriod.current !== null) {
      setManuallyExpanded(new Set());
      setManuallyCollapsed(new Set());
    }
    prevActivePeriod.current = activePeriodName;
  }, [activePeriodName]);

  // Reset manual expansions when date changes
  useEffect(() => {
    setManuallyExpanded(new Set());
    setManuallyCollapsed(new Set());
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

  const togglePeriod = useCallback((periodName: string, isDefaultExpanded: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync();
    if (isDefaultExpanded) {
      // Active period: toggle manuallyCollapsed
      setManuallyCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(periodName)) {
          next.delete(periodName);
        } else {
          next.add(periodName);
        }
        return next;
      });
    } else {
      // Non-active period: toggle manuallyExpanded
      setManuallyExpanded(prev => {
        const next = new Set(prev);
        if (next.has(periodName)) {
          next.delete(periodName);
        } else {
          next.add(periodName);
        }
        return next;
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      {MEAL_PERIODS.map((period, periodIndex) => {
        const anim = periodAnims[periodIndex];
        const Icon = PERIOD_ICONS[period.icon];
        const isPeriodFullyPast = fullyPastPeriods.has(period.name);
        const isActivePeriod = period.name === activePeriodName;

        // Default expanded = active period AND not fully past
        const defaultExpanded = isActivePeriod && !isPeriodFullyPast;
        const isCollapsed = defaultExpanded
          ? manuallyCollapsed.has(period.name)
          : !manuallyExpanded.has(period.name);

        const availableCount = period.times.filter(t => !disabledTimes.has(t)).length;

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
            {/* Period header — always tappable */}
            <Pressable
              style={[
                styles.periodHeader,
                isCollapsed && styles.periodHeaderCollapsible,
              ]}
              onPress={() => togglePeriod(period.name, defaultExpanded)}
            >
              <Icon
                size={14}
                color={
                  isPeriodFullyPast
                    ? Colors.textTertiary
                    : isActivePeriod
                      ? Colors.primary
                      : Colors.textSecondary
                }
              />
              <Text style={[
                styles.periodLabel,
                {
                  color: isPeriodFullyPast
                    ? Colors.textTertiary
                    : isActivePeriod
                      ? Colors.primary
                      : Colors.textSecondary,
                },
              ]}>
                {period.name}
              </Text>
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isPeriodFullyPast && (
                  <Text style={{ fontSize: 12, color: Colors.textTertiary }}>Passed</Text>
                )}
                {!isPeriodFullyPast && isCollapsed && (
                  <View style={[styles.countBadge, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
                    <Text style={[styles.countBadgeText, { color: Colors.textSecondary }]}>
                      {availableCount}
                    </Text>
                  </View>
                )}
                <ChevronRight
                  size={14}
                  color={isPeriodFullyPast ? Colors.textTertiary : Colors.textSecondary}
                  style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}
                />
              </View>
            </Pressable>

            {/* Time chips grid — hidden when collapsed */}
            {!isCollapsed && (
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
            )}
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
  periodHeaderCollapsible: {
    marginBottom: 0,
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
  countBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
