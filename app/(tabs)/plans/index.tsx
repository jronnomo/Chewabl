import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PlanCard from '../../../components/PlanCard';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { rsvpPlan } from '../../../services/plans';
import { DiningPlan } from '../../../types';
import StaticColors from '../../../constants/colors';
import { useColors } from '../../../context/ThemeContext';

const Colors = StaticColors;

type TabFilter = 'upcoming' | 'past' | 'all';

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const { plans } = useApp();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabFilter>('upcoming');
  const { planId, from } = useLocalSearchParams<{ planId?: string; from?: string }>();

  // Auto-switch tab when navigating with a planId deep link
  useEffect(() => {
    if (!planId || plans.length === 0) return;
    const target = plans.find(p => p.id === planId);
    if (!target) return;
    if (target.status === 'completed' || target.status === 'cancelled') {
      setActiveTab('past');
    } else {
      setActiveTab('upcoming');
    }
  }, [planId, plans]);

  const rsvpMutation = useMutation({
    mutationFn: ({ planId, action }: { planId: string; action: 'accept' | 'decline' }) =>
      rsvpPlan(planId, action),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      Alert.alert('Done', variables.action === 'accept' ? 'You accepted the invite!' : 'Invite declined.');
    },
    onError: (err: Error) => {
      Alert.alert('RSVP Failed', err.message || 'Something went wrong. Please try again.');
    },
  });

  const handlePlanPress = useCallback((plan: DiningPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if user has a pending invite on this plan
    if (isAuthenticated && user && plan.invites) {
      const myInvite = plan.invites.find(i => i.userId === user.id && i.status === 'pending');
      if (myInvite) {
        const dateTimeStr = plan.date ? `${plan.date}${plan.time ? ` at ${plan.time}` : ''}` : 'No date set';
        Alert.alert(
          `"${plan.title}"`,
          `${dateTimeStr}\n\nWill you attend?`,
          [
            {
              text: 'Decline',
              style: 'destructive',
              onPress: () => rsvpMutation.mutate({ planId: plan.id, action: 'decline' }),
            },
            {
              text: 'Accept',
              onPress: () => rsvpMutation.mutate({ planId: plan.id, action: 'accept' }),
            },
          ]
        );
        return;
      }
    }

    // Group-swipe plans: voting → swipe, confirmed → show results
    if (plan.type === 'group-swipe' && (plan.status === 'voting' || plan.status === 'confirmed')) {
      router.push(`/group-session?planId=${plan.id}&autoStart=true` as never);
      return;
    }

    // F-005-008: onPress for non-voting plan cards — show info
    const infoDateStr = plan.date ? `${plan.date}${plan.time ? ` at ${plan.time}` : ''}` : 'No date';
    Alert.alert(
      plan.title,
      `${infoDateStr}\nStatus: ${plan.status}\nCuisine: ${plan.cuisine ?? 'Any'} · Budget: ${plan.budget ?? 'Any'}`,
    );
  }, [isAuthenticated, user, rsvpMutation, router]);

  const handlePlanEdit = useCallback((plan: DiningPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/plan-event?planId=${plan.id}` as never);
  }, [router]);

  const filteredPlans = useMemo(() => {
    switch (activeTab) {
      case 'upcoming':
        return plans.filter(p => p.status === 'voting' || p.status === 'confirmed');
      case 'past':
        return plans.filter(p => p.status === 'completed' || p.status === 'cancelled');
      default:
        return plans;
    }
  }, [plans, activeTab]);

  const handleNewPlan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/plan-event' as never);
  }, [router]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {from === 'notifications' && (
            <Pressable
              onPress={() => router.push('/notifications' as never)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="Back to notifications"
              accessibilityRole="button"
            >
              <ArrowLeft size={18} color={Colors.text} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: Colors.text }]}>My Plans</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={handleNewPlan} testID="new-plan-btn" accessibilityLabel="Create new plan" accessibilityRole="button">
          <Plus size={20} color="#FFF" />
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              { backgroundColor: Colors.card, borderColor: Colors.border },
              activeTab === tab.key && { backgroundColor: Colors.primary, borderColor: Colors.primary },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabText, { color: Colors.textSecondary }, activeTab === tab.key && { color: '#FFF' }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredPlans}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PlanCard
            plan={item}
            currentUserId={user?.id}
            onPress={() => handlePlanPress(item)}
            onEdit={item.type === 'group-swipe' ? undefined : () => handlePlanEdit(item)}
            onRestaurantPress={item.restaurant ? () => router.push(`/restaurant/${item.restaurant!.id}` as never) : undefined}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={[styles.emptyTitle, { color: Colors.text }]}>No plans yet</Text>
            <Text style={[styles.emptySubtext, { color: Colors.textSecondary }]}>Create a dining plan to get started</Text>
            <Pressable style={styles.emptyBtn} onPress={handleNewPlan}>
              <Text style={styles.emptyBtnText}>Create Plan</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          rsvpMutation.isPending ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : null
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
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
  emptyBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
