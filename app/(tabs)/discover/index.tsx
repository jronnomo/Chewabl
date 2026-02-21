import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Search, SlidersHorizontal, X, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RestaurantCard from '../../../components/RestaurantCard';
import { CUISINES, BUDGET_OPTIONS } from '../../../mocks/restaurants';
import { useSearchRestaurants } from '../../../context/AppContext';
import StaticColors from '../../../constants/colors';
import { useColors } from '../../../context/ThemeContext';

const Colors = StaticColors;

export default function DiscoverScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const dealsMode = filter === 'deals';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const [selectedBudget, setSelectedBudget] = useState<string>('All');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const filterHeight = useRef(new Animated.Value(0)).current;

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: rawRestaurants = [] } = useSearchRestaurants(
    debouncedQuery,
    selectedCuisine,
    selectedBudget
  );
  const filteredRestaurants = dealsMode
    ? rawRestaurants.filter(r => r.lastCallDeal)
    : rawRestaurants;

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = showFilters ? 0 : 1;
    Animated.spring(filterHeight, {
      toValue,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setShowFilters(!showFilters);
  }, [showFilters, filterHeight]);

  const filterContainerHeight = filterHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  const activeFilterCount = (selectedCuisine !== 'All' ? 1 : 0) + (selectedBudget !== 'All' ? 1 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        {dealsMode ? (
          <View style={styles.dealsTitleRow}>
            <Flame size={22} color={Colors.error} />
            <Text style={styles.headerTitle}>Last Call Deals</Text>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Discover</Text>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={toggleFilters}
          testID="filter-btn"
        >
          <SlidersHorizontal size={18} color={showFilters ? '#FFF' : Colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Animated.View style={[styles.filterContainer, { height: filterContainerHeight, overflow: 'hidden' }]}>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Cuisine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {['All', ...CUISINES].map(c => (
                <Pressable
                  key={c}
                  style={[styles.chip, selectedCuisine === c && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCuisine(c);
                  }}
                >
                  <Text style={[styles.chipText, selectedCuisine === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Budget</Text>
          <View style={styles.chipRow}>
            {['All', ...BUDGET_OPTIONS].map(b => (
              <Pressable
                key={b}
                style={[styles.chip, selectedBudget === b && styles.chipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedBudget(b);
                }}
              >
                <Text style={[styles.chipText, selectedBudget === b && styles.chipTextActive]}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>

      <FlatList
        data={filteredRestaurants}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <RestaurantCard restaurant={item} variant="vertical" />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{dealsMode ? '🔥' : '🍽️'}</Text>
            <Text style={styles.emptyTitle}>{dealsMode ? 'No deals right now' : 'No restaurants found'}</Text>
            <Text style={styles.emptySubtext}>{dealsMode ? 'Check back closer to closing time' : 'Try adjusting your filters'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dealsTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: 44,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  filterContainer: {
    paddingHorizontal: 20,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
