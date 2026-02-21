import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
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

  const rsvpMutation = useMutation({
    mutationFn: ({ planId, action }: { planId: string; action: 'accept' | 'decline' }) =>
      rsvpPlan(planId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const handlePlanPress = useCallback((plan: DiningPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if user has a pending invite on this plan
    if (isAuthenticated && user && plan.invites) {
      const myInvite = plan.invites.find(i => i.userId === user.id && i.status === 'pending');
      if (myInvite) {
        Alert.alert(
          `"${plan.title}"`,
          `${plan.date} at ${plan.time}\n\nWill you attend?`,
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

    // For voting/confirmed plans, offer to start group swipe
    if (plan.status === 'voting' || plan.status === 'confirmed') {
      Alert.alert(
        plan.title,
        `${plan.date} at ${plan.time}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Group Swipe',
            onPress: () => router.push(`/group-session?planId=${plan.id}` as never),
          },
        ]
      );
    }
  }, [isAuthenticated, user, rsvpMutation, router]);

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
        <Text style={styles.headerTitle}>My Plans</Text>
        <Pressable style={styles.addBtn} onPress={handleNewPlan} testID="new-plan-btn">
          <Plus size={20} color="#FFF" />
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.key);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredPlans}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PlanCard plan={item} onPress={() => handlePlanPress(item)} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No plans yet</Text>
            <Text style={styles.emptySubtext}>Create a dining plan to get started</Text>
            <Pressable style={styles.emptyBtn} onPress={handleNewPlan}>
              <Text style={styles.emptyBtnText}>Create Plan</Text>
            </Pressable>
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
  tabActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
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
