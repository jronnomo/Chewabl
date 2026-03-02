import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

interface CalendarSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CalendarSheet({ visible, onClose, onSelectDate, selectedDate }: CalendarSheetProps) {
  const Colors = useColors();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 60);

  // Parse the incoming selectedDate to a Date for initial temp selection
  const parseSelectedDate = useCallback((): Date => {
    if (!selectedDate) return new Date(today);
    const d = new Date(selectedDate + 'T00:00:00');
    // Clamp to today–maxDate range
    if (d < today) return new Date(today);
    if (d > maxDate) return new Date(maxDate);
    return d;
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tempSelectedDate, setTempSelectedDate] = useState<Date>(parseSelectedDate);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = parseSelectedDate();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Sync when visible changes (re-open should reset to current selectedDate)
  useEffect(() => {
    if (visible) {
      const d = parseSelectedDate();
      setTempSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Month transition animation
  const gridOpacity = useRef(new Animated.Value(1)).current;

  // Day cell scale animations — keyed by "YYYY-MM-DD"
  const dayCellAnims = useRef<Record<string, Animated.Value>>({}).current;
  const ensureDayAnim = (key: string) => {
    if (!dayCellAnims[key]) {
      dayCellAnims[key] = new Animated.Value(1);
    }
    return dayCellAnims[key];
  };

  const navigateMonth = useCallback((direction: 1 | -1) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);

    // Block navigation outside allowed range
    if (direction === -1 && newMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    if (direction === 1 && newMonth > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)) return;

    Animated.timing(gridOpacity, {
      toValue: 0,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentMonth(newMonth);
      Animated.timing(gridOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [currentMonth, gridOpacity, today, maxDate]);

  const handleDayPress = useCallback((date: Date) => {
    const key = formatDateToISO(date);
    Haptics.selectionAsync();
    setTempSelectedDate(date);

    const scaleAnim = ensureDayAnim(key);
    Animated.spring(scaleAnim, {
      toValue: 1.05,
      tension: 300,
      friction: 12,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });
  }, [dayCellAnims]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectDate(formatDateToISO(tempSelectedDate));
    onClose();
  }, [tempSelectedDate, onSelectDate, onClose]);

  // Build calendar grid for current month
  const calendarDays = useCallback((): (Date | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0 = Sunday
    const cells: (Date | null)[] = [];

    // Leading nulls for days before the first
    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(year, month, d));
    }
    // Pad to complete last row
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [currentMonth]);

  const isPastDay = (date: Date) => date < today;
  const isBeyondMax = (date: Date) => date > maxDate;

  const canGoBack = currentMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoForward = currentMonth < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = calendarDays();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: Colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: Colors.card }]} onPress={e => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: Colors.border }]} />

          {/* Month navigation header */}
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => navigateMonth(-1)}
              disabled={!canGoBack}
              style={[styles.arrowBtn, !canGoBack && styles.arrowDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={20} color={canGoBack ? Colors.primary : Colors.textTertiary} />
            </Pressable>

            <Text style={[styles.monthTitle, { color: Colors.text }]}>
              {monthLabel}
            </Text>

            <Pressable
              onPress={() => navigateMonth(1)}
              disabled={!canGoForward}
              style={[styles.arrowBtn, !canGoForward && styles.arrowDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={20} color={canGoForward ? Colors.primary : Colors.textTertiary} />
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeadersRow}>
            {DAY_HEADERS.map((d) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, { color: Colors.textSecondary }]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <Animated.View style={[styles.calendarGrid, { opacity: gridOpacity }]}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const key = formatDateToISO(date);
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, tempSelectedDate);
              const isPast = isPastDay(date);
              const isBeyond = isBeyondMax(date);
              const isDisabled = isPast || isBeyond;
              const scaleAnim = ensureDayAnim(key);

              return (
                <Animated.View
                  key={key}
                  style={[styles.dayCell, { transform: [{ scale: scaleAnim }] }]}
                >
                  <Pressable
                    style={[
                      styles.dayCellInner,
                      isToday && !isSelected && { borderWidth: 2, borderColor: Colors.primary },
                      isSelected && { backgroundColor: Colors.primary },
                      isDisabled && styles.dayDisabled,
                    ]}
                    onPress={() => !isDisabled && handleDayPress(date)}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: Colors.text },
                        isSelected && { color: '#FFF' },
                        isDisabled && { color: Colors.textTertiary },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>

          {/* Select Date button */}
          <Pressable
            style={[styles.selectBtn, { backgroundColor: Colors.primary, shadowColor: Colors.primary }]}
            onPress={handleSelectDate}
            accessibilityRole="button"
          >
            <Text style={styles.selectBtnText}>Select Date</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 16,
  },
  arrowBtn: {
    padding: 8,
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCellInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  selectBtn: {
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
  selectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
