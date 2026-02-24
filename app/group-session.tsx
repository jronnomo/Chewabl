import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Users,
  Check,
  Crown,
  Heart,
  X as XIcon,
  Share2,
  ChevronRight,
  Star,
  MapPin,
  Utensils,
  UserPlus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SwipeCard from '@/components/SwipeCard';
import { useApp, useNearbyRestaurants } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getFriends } from '@/services/friends';
import { createPlan, submitSwipes, getPlan } from '@/services/plans';
import { Restaurant, GroupMember, SwipeResult, Friend, DiningPlan } from '@/types';
import StaticColors from '@/constants/colors';
import { useColors } from '@/context/ThemeContext';

const Colors = StaticColors;
const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

type Phase = 'lobby' | 'swiping' | 'waiting' | 'results';

export default function GroupSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const params = useLocalSearchParams<{ planId?: string; curveball?: string; autoStart?: string }>();
  const { preferences, plans, localAvatarUri } = useApp();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: nearbyRestaurants = [] } = useNearbyRestaurants();

  // Active plan state — set when creating or fetching an existing plan
  const [activePlan, setActivePlan] = useState<DiningPlan | null>(() => {
    if (params.planId) {
      return plans.find(p => p.id === params.planId) ?? null;
    }
    return null;
  });

  const sessionRestaurants = useMemo(() => {
    // Prioritize restaurantOptions from active plan (real group-swipe deck)
    if (activePlan?.restaurantOptions && activePlan.restaurantOptions.length > 0) {
      return activePlan.restaurantOptions;
    }

    // Fall back to plan.options (legacy)
    if (activePlan?.options && activePlan.options.length > 0) {
      return activePlan.options;
    }

    // Use live nearby restaurants from Google Places
    return [...nearbyRestaurants].sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (preferences.cuisines.includes(a.cuisine)) scoreA += 2;
      if (preferences.cuisines.includes(b.cuisine)) scoreB += 2;
      if (a.isOpenNow) scoreA += 1;
      if (b.isOpenNow) scoreB += 1;
      return scoreB - scoreA;
    });
  }, [preferences.cuisines, activePlan, nearbyRestaurants]);

  // Derive members from plan invites if available, otherwise start with just the host
  const initialMembers = useMemo((): GroupMember[] => {
    const meEntry: GroupMember = {
      id: user?.id ?? 'me',
      name: user?.name ? `${user.name} (You)` : 'You',
      avatar: localAvatarUri ?? user?.avatarUri ?? FALLBACK_AVATAR,
      completedSwiping: activePlan?.swipesCompleted?.includes(user?.id ?? '') ?? false,
    };

    const plan = activePlan;
    if (plan?.invites && plan.invites.length > 0) {
      // For group-swipe: all non-declined invitees are members (pending or accepted)
      const eligible = plan.type === 'group-swipe'
        ? plan.invites.filter(i => i.status !== 'declined')
        : plan.invites.filter(i => i.status === 'accepted');
      if (eligible.length > 0) {
        const others: GroupMember[] = eligible.map(inv => ({
          id: inv.userId,
          name: inv.name,
          avatar: inv.avatarUri ?? FALLBACK_AVATAR,
          completedSwiping: plan.swipesCompleted?.includes(inv.userId) ?? false,
        }));
        return [meEntry, ...others];
      }
    }

    return [meEntry];
  }, [activePlan, user, localAvatarUri]);

  const myMemberId = initialMembers[0]?.id ?? 'me';

  // Determine initial phase based on plan state when entering from My Plans
  const getInitialPhase = (): Phase => {
    if (activePlan) {
      if (activePlan.status === 'confirmed') return 'results';
      if (activePlan.swipesCompleted?.includes(user?.id ?? '')) return 'waiting';
      if (params.autoStart === 'true') return 'swiping';
    }
    return params.autoStart === 'true' ? 'swiping' : 'lobby';
  };

  const [phase, setPhase] = useState<Phase>(getInitialPhase);
  const [members, setMembers] = useState<GroupMember[]>(initialMembers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [mySwipes, setMySwipes] = useState<Record<string, 'yes' | 'no'>>({});
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    animateIn();
  }, [phase, animateIn]);

  // Build results from plan votes data (used when plan is confirmed)
  const buildResultsFromPlan = useCallback((plan: DiningPlan): SwipeResult[] => {
    const restaurants = plan.restaurantOptions ?? [];
    const planVotes = plan.votes ?? {};
    const totalMembers = 1 + (plan.invites?.filter(i => i.status === 'accepted').length ?? 0);

    const voteCounts: Record<string, number> = {};
    for (const userVotes of Object.values(planVotes)) {
      for (const rid of userVotes) {
        voteCounts[rid] = (voteCounts[rid] || 0) + 1;
      }
    }

    const resultList: SwipeResult[] = restaurants.map(r => {
      const yesCount = voteCounts[r.id] || 0;
      return {
        restaurantId: r.id,
        restaurant: r,
        yesCount,
        totalMembers,
        isMatch: yesCount === totalMembers,
      };
    });

    resultList.sort((a, b) => b.yesCount - a.yesCount || b.restaurant.rating - a.restaurant.rating);
    return resultList;
  }, []);

  // Build results on mount if plan is already confirmed
  useEffect(() => {
    if (phase === 'results' && results.length === 0 && activePlan?.status === 'confirmed') {
      setResults(buildResultsFromPlan(activePlan));
    }
  }, [phase, results.length, activePlan, buildResultsFromPlan]);

  // Poll for plan completion when in waiting phase
  useEffect(() => {
    if (phase !== 'waiting' || !activePlan?.id) return;

    const interval = setInterval(async () => {
      try {
        const freshPlan = await getPlan(activePlan.id);
        setActivePlan(freshPlan);

        // Update member completion status
        if (freshPlan.swipesCompleted) {
          setMembers(prev => prev.map(m => ({
            ...m,
            completedSwiping: freshPlan.swipesCompleted!.includes(m.id),
          })));
        }

        if (freshPlan.status === 'confirmed') {
          const res = buildResultsFromPlan(freshPlan);
          setResults(res);
          setPhase('results');
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [phase, activePlan?.id, buildResultsFromPlan]);

  const handleRemoveMember = useCallback((memberId: string) => {
    // F-006-017: Warn when removing the last non-host member
    const nonHostMembers = members.filter(m => m.id !== myMemberId);
    if (nonHostMembers.length === 1 && nonHostMembers[0].id === memberId) {
      Alert.alert(
        'Remove Last Member?',
        'You\'ll be swiping solo. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMembers(prev => prev.filter(m => m.id !== memberId));
            },
          },
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }, [members, myMemberId]);

  const handleAddMember = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleMemberAdded = useCallback((member: GroupMember) => {
    setMembers(prev => {
      if (prev.some(m => m.id === member.id)) return prev; // no duplicates
      return [...prev, member];
    });
    setShowAddModal(false);
  }, []);

  const handleStartSwiping = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (isAuthenticated && !activePlan) {
      try {
        setIsSubmitting(true);
        const inviteeIds = members
          .filter(m => m.id !== myMemberId)
          .map(m => m.id);
        const plan = await createPlan({
          type: 'group-swipe',
          title: 'Group Pick',
          cuisine: preferences.cuisines[0] || 'Any',
          budget: preferences.budget || '$$',
          status: 'voting',
          restaurantOptions: sessionRestaurants,
          inviteeIds: inviteeIds.length > 0 ? inviteeIds : undefined,
        });
        setActivePlan(plan);
        queryClient.invalidateQueries({ queryKey: ['plans'] });
      } catch {
        Alert.alert('Error', 'Failed to start group swipe. Please try again.');
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    setPhase('swiping');
  }, [isAuthenticated, activePlan, members, myMemberId, preferences, sessionRestaurants, queryClient]);

  // Submit swipes to backend and handle result
  const finishSwiping = useCallback(async (allMySwipes: Record<string, 'yes' | 'no'>) => {
    const yesVotes = Object.entries(allMySwipes)
      .filter(([, v]) => v === 'yes')
      .map(([id]) => id);

    setMembers(prev => prev.map(m =>
      m.id === myMemberId ? { ...m, completedSwiping: true } : m
    ));

    if (isAuthenticated && activePlan) {
      try {
        setIsSubmitting(true);
        const updatedPlan = await submitSwipes(activePlan.id, yesVotes);
        setActivePlan(updatedPlan);
        queryClient.invalidateQueries({ queryKey: ['plans'] });

        if (updatedPlan.status === 'confirmed') {
          const res = buildResultsFromPlan(updatedPlan);
          setResults(res);
          setPhase('results');
        } else {
          // Plan still voting — go to waiting phase
          setPhase('waiting');
        }
      } catch {
        Alert.alert('Error', 'Failed to submit votes. Please try again.');
        setPhase('lobby');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Offline / not authenticated — build results locally from own swipes
      const resultList: SwipeResult[] = sessionRestaurants.map(r => ({
        restaurantId: r.id,
        restaurant: r,
        yesCount: allMySwipes[r.id] === 'yes' ? 1 : 0,
        totalMembers: 1,
        isMatch: allMySwipes[r.id] === 'yes',
      }));
      resultList.sort((a, b) => b.yesCount - a.yesCount || b.restaurant.rating - a.restaurant.rating);
      setResults(resultList);
      setPhase('results');
    }
  }, [myMemberId, isAuthenticated, activePlan, sessionRestaurants, buildResultsFromPlan, queryClient]);

  const handleSwipeRight = useCallback((restaurant: Restaurant) => {
    setIsAnimating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMySwipes(prev => {
      const updated = { ...prev, [restaurant.id]: 'yes' as const };
      if (Object.keys(updated).length >= sessionRestaurants.length) {
        setTimeout(() => finishSwiping(updated), 400);
      }
      return updated;
    });
    setCurrentIndex(prev => prev + 1);
    setTimeout(() => setIsAnimating(false), 350);
  }, [sessionRestaurants.length, finishSwiping]);

  const handleSwipeLeft = useCallback((restaurant: Restaurant) => {
    setIsAnimating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMySwipes(prev => {
      const updated = { ...prev, [restaurant.id]: 'no' as const };
      if (Object.keys(updated).length >= sessionRestaurants.length) {
        setTimeout(() => finishSwiping(updated), 400);
      }
      return updated;
    });
    setCurrentIndex(prev => prev + 1);
    setTimeout(() => setIsAnimating(false), 350);
  }, [sessionRestaurants.length, finishSwiping]);

  const topMatch = results.length > 0 ? results[0] : null;
  const perfectMatches = results.filter(r => r.isMatch);

  if (phase === 'lobby') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <Animated.View style={[styles.phaseContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.lobbyHeader}>
            <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
              <ArrowLeft size={20} color={Colors.text} />
            </Pressable>
            <Text style={[styles.lobbyTitle, { color: Colors.text }]}>Group Swipe</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.lobbyHero}>
            <View style={[styles.lobbyIconWrap, { backgroundColor: Colors.primaryLight }]}>
              <Utensils size={32} color={Colors.primary} />
            </View>
            <Text style={[styles.lobbyHeroTitle, { color: Colors.text }]}>Swipe Together</Text>
            <Text style={[styles.lobbyHeroSub, { color: Colors.textSecondary }]}>
              Everyone swipes {sessionRestaurants.length} restaurants together. The group's top match wins!
            </Text>
          </View>

          <View style={[styles.membersSection, { backgroundColor: Colors.card }]}>
            <View style={styles.membersSectionHeader}>
              <Users size={16} color={Colors.textSecondary} />
              <Text style={[styles.membersSectionTitle, { color: Colors.textSecondary }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
            {members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <Image source={{ uri: member.avatar }} style={styles.memberAvatar} contentFit="cover" />
                <Text style={[styles.memberName, { color: Colors.text }]}>{member.name}</Text>
                {member.id === myMemberId ? (
                  <View style={[styles.hostBadge, { backgroundColor: Colors.secondaryLight }]}>
                    <Crown size={11} color={Colors.secondary} />
                    <Text style={[styles.hostBadgeText, { color: Colors.secondary }]}>Host</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.removeMemberBtn, { backgroundColor: Colors.error + '18' }]}
                    onPress={() => handleRemoveMember(member.id)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${member.name}`}
                    accessibilityRole="button"
                  >
                    <XIcon size={16} color={Colors.error} />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 4 }}
              onPress={handleAddMember}
            >
              <UserPlus size={16} color={Colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary }}>Add Person</Text>
            </Pressable>
          </View>

        </Animated.View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: Colors.card, borderTopColor: Colors.borderLight }]}>
          {sessionRestaurants.length === 0 ? (
            // F-006-012: Zero restaurant edge case
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                No restaurants match your filters. Try adjusting your preferences.
              </Text>
            </View>
          ) : members.length < 2 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                Add at least one friend to start swiping
              </Text>
            </View>
          ) : (
            <Pressable style={styles.startBtn} onPress={handleStartSwiping} disabled={isSubmitting} testID="start-swiping-btn">
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.startBtnText}>Start Swiping</Text>
                  <ChevronRight size={18} color="#FFF" />
                </>
              )}
            </Pressable>
          )}
        </View>

        <AddMemberModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAddMember={handleMemberAdded}
          existingMemberIds={members.map(m => m.id)}
        />
      </View>
    );
  }

  if (phase === 'swiping') {
    const progress = sessionRestaurants.length > 0
      ? currentIndex / sessionRestaurants.length
      : 0;

    // F-006-024: Only count members who actually completed (the host finishes at results phase)
    const completedCount = members.filter(m => m.completedSwiping && m.id !== myMemberId).length;
    const isSolo = members.length <= 1;

    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={styles.swipeHeader}>
          <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => params.autoStart === 'true' ? router.back() : setPhase('lobby')} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.swipeHeaderCenter}>
            <Text style={[styles.swipeHeaderTitle, { color: Colors.text }]}>Group Swipe</Text>
            <View style={styles.membersAvatarRow}>
              {members.slice(0, 4).map(m => (
                <Image key={m.id} source={{ uri: m.avatar }} style={[styles.miniAvatar, { borderColor: Colors.card }]} contentFit="cover" />
              ))}
              <Text style={[styles.swipeCount, { color: Colors.textTertiary }]}>
                {currentIndex}/{sessionRestaurants.length}
              </Text>
            </View>
          </View>
          {!isSolo && (
            <View style={[styles.friendProgress, { backgroundColor: Colors.success + '18' }]}>
              <Check size={14} color={Colors.success} />
              <Text style={[styles.friendProgressText, { color: Colors.success }]}>
                {completedCount}/{members.length - 1}
              </Text>
            </View>
          )}
          {isSolo && <View style={{ width: 40 }} />}
        </View>

        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.cardStack}>
          {sessionRestaurants.slice(currentIndex, currentIndex + 2).reverse().map((restaurant, i) => {
            const isTop = i === (Math.min(2, sessionRestaurants.length - currentIndex) - 1);
            return (
              <SwipeCard
                key={restaurant.id}
                restaurant={restaurant}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onTap={(r) => router.push(`/restaurant/${r.id}` as never)}
                isTop={isTop}
              />
            );
          })}
        </View>

        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnNo]}
            onPress={() => {
              if (isAnimating) return;
              if (currentIndex < sessionRestaurants.length) {
                handleSwipeLeft(sessionRestaurants[currentIndex]);
              }
            }}
            accessibilityLabel="Pass on restaurant"
            accessibilityRole="button"
          >
            <XIcon size={28} color={Colors.error} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnYes]}
            onPress={() => {
              if (isAnimating) return;
              if (currentIndex < sessionRestaurants.length) {
                handleSwipeRight(sessionRestaurants[currentIndex]);
              }
            }}
            accessibilityLabel="Like restaurant"
            accessibilityRole="button"
          >
            <Heart size={28} color="#FFF" fill="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === 'waiting') {
    const completedMembers = members.filter(m => m.completedSwiping);
    const pendingMembers = members.filter(m => !m.completedSwiping);
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <Animated.View style={[styles.phaseContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.lobbyHeader}>
            <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
              <ArrowLeft size={20} color={Colors.text} />
            </Pressable>
            <Text style={[styles.lobbyTitle, { color: Colors.text }]}>Group Swipe</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 48, paddingBottom: 32 }}>
            <View style={[styles.lobbyIconWrap, { backgroundColor: Colors.success + '18' }]}>
              <Check size={36} color={Colors.success} />
            </View>
            <Text style={[styles.lobbyHeroTitle, { color: Colors.text, marginTop: 16 }]}>Your votes are in!</Text>
            <Text style={[styles.lobbyHeroSub, { color: Colors.textSecondary, marginTop: 8 }]}>
              Waiting for others to finish swiping...
            </Text>
          </View>

          <View style={[styles.membersSection, { backgroundColor: Colors.card }]}>
            <View style={styles.membersSectionHeader}>
              <Users size={16} color={Colors.textSecondary} />
              <Text style={[styles.membersSectionTitle, { color: Colors.textSecondary }]}>
                {completedMembers.length}/{members.length} finished
              </Text>
            </View>
            {members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <Image source={{ uri: member.avatar }} style={styles.memberAvatar} contentFit="cover" />
                <Text style={[styles.memberName, { color: Colors.text }]}>{member.name}</Text>
                {member.completedSwiping ? (
                  <View style={[styles.hostBadge, { backgroundColor: Colors.success + '18' }]}>
                    <Check size={11} color={Colors.success} />
                    <Text style={[styles.hostBadgeText, { color: Colors.success }]}>Done</Text>
                  </View>
                ) : (
                  <View style={[styles.hostBadge, { backgroundColor: Colors.secondaryLight }]}>
                    <Text style={[styles.hostBadgeText, { color: Colors.secondary }]}>Swiping...</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {pendingMembers.length > 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>
                We'll notify you when everyone's done
              </Text>
            </View>
          )}
        </Animated.View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: Colors.card, borderTopColor: Colors.borderLight }]}>
          <Pressable
            style={[styles.startBtn, { backgroundColor: Colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.back();
            }}
          >
            <Text style={styles.startBtnText}>Go to Plans</Text>
            <ChevronRight size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  const isSoloResults = members.length <= 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <Animated.View style={[styles.resultsPhase, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.resultsHeader}>
          <Pressable style={[styles.backBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={20} color={Colors.text} />
          </Pressable>
          <Text style={[styles.resultsTitle, { color: Colors.text }]}>Results</Text>
          <Pressable
            style={[styles.shareBtn, { backgroundColor: Colors.primaryLight }]}
            onPress={() => Alert.alert('Coming Soon', 'Sharing will be available in a future update.')}
            accessibilityLabel="Share results"
            accessibilityRole="button"
          >
            <Share2 size={18} color={Colors.primary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsScroll}>
          {topMatch && (
            <View style={[styles.winnerCard, { backgroundColor: Colors.card }]}>
              <View style={[styles.winnerCrown, { backgroundColor: Colors.secondaryLight }]}>
                <Crown size={20} color={Colors.star} />
                <Text style={[styles.winnerLabel, { color: Colors.secondary }]}>
                  {topMatch.isMatch ? (isSoloResults ? 'Your Top Pick!' : 'Perfect Match!') : 'Top Pick'}
                </Text>
              </View>
              <Image
                source={{ uri: topMatch.restaurant.imageUrl }}
                style={styles.winnerImage}
                contentFit="cover"
              />
              <View style={styles.winnerOverlay} />
              <View style={styles.winnerContent}>
                <Text style={[styles.winnerName, { color: Colors.text }]}>{topMatch.restaurant.name}</Text>
                <Text style={[styles.winnerCuisine, { color: Colors.textSecondary }]}>
                  {topMatch.restaurant.cuisine} · {'$'.repeat(topMatch.restaurant.priceLevel)}
                </Text>
                {!isSoloResults && (
                  <View style={styles.winnerVoteBar}>
                    <View style={styles.winnerVotes}>
                      {Array.from({ length: topMatch.totalMembers }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.voteDot,
                            i < topMatch.yesCount ? styles.voteDotYes : styles.voteDotNo,
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.winnerVoteText, { color: Colors.textSecondary }]}>
                      {topMatch.yesCount}/{topMatch.totalMembers} said yes
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                style={styles.winnerBtn}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  router.push(`/restaurant/${topMatch.restaurant.id}` as never);
                }}
              >
                <Text style={styles.winnerBtnText}>View Restaurant</Text>
              </Pressable>
            </View>
          )}

          {!isSoloResults && perfectMatches.length > 1 && (
            <View style={styles.matchesSection}>
              <Text style={[styles.matchesSectionTitle, { color: Colors.text }]}>All Perfect Matches</Text>
              {perfectMatches.map(m => (
                <Pressable
                  key={m.restaurantId}
                  style={[styles.matchCard, { backgroundColor: Colors.card }]}
                  onPress={() => router.push(`/restaurant/${m.restaurantId}` as never)}
                >
                  <Image source={{ uri: m.restaurant.imageUrl }} style={styles.matchImage} contentFit="cover" />
                  <View style={styles.matchInfo}>
                    <Text style={[styles.matchName, { color: Colors.text }]}>{m.restaurant.name}</Text>
                    <Text style={[styles.matchCuisine, { color: Colors.textSecondary }]}>{m.restaurant.cuisine}</Text>
                  </View>
                  <View style={styles.matchBadge}>
                    <Heart size={12} color="#FFF" fill="#FFF" />
                    <Text style={styles.matchBadgeText}>{m.yesCount}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.allResultsSection}>
            <Text style={[styles.allResultsTitle, { color: Colors.text }]}>All Rankings</Text>
            {results.map((r, i) => (
              <Pressable
                key={r.restaurantId}
                style={[styles.rankCard, { backgroundColor: Colors.card }]}
                onPress={() => router.push(`/restaurant/${r.restaurantId}` as never)}
              >
                <View style={[
                  styles.rankBadge,
                  { backgroundColor: Colors.borderLight },
                  i === 0 && styles.rankBadgeGold,
                  i === 1 && styles.rankBadgeSilver,
                  i === 2 && styles.rankBadgeBronze,
                ]}>
                  <Text style={[
                    styles.rankNumber,
                    { color: Colors.textSecondary },
                    i < 3 && { color: Colors.text },
                  ]}>
                    {i + 1}
                  </Text>
                </View>
                <Image source={{ uri: r.restaurant.imageUrl }} style={styles.rankImage} contentFit="cover" />
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, { color: Colors.text }]} numberOfLines={1}>{r.restaurant.name}</Text>
                  <View style={styles.rankMeta}>
                    <Star size={11} color={Colors.star} fill={Colors.star} />
                    <Text style={[styles.rankRating, { color: Colors.text }]}>{r.restaurant.rating}</Text>
                    <MapPin size={11} color={Colors.textTertiary} />
                    <Text style={[styles.rankDistance, { color: Colors.textTertiary }]}>{r.restaurant.distance}</Text>
                  </View>
                </View>
                <View style={styles.rankVotesWrap}>
                  <View style={styles.rankVoteBar}>
                    <View style={[styles.rankVoteFill, { width: `${(r.yesCount / r.totalMembers) * 100}%` }]} />
                  </View>
                  <Text style={[styles.rankVoteLabel, { color: Colors.textSecondary }]}>{r.yesCount}/{r.totalMembers}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {!isSoloResults && (
            <View style={[styles.memberVoteSummary, { backgroundColor: Colors.card }]}>
              <Text style={[styles.memberVoteTitle, { color: Colors.text }]}>Who voted what</Text>
              {members.map(m => {
                const planVotes = activePlan?.votes ?? {};
                const memberVotes = planVotes[m.id] ?? (m.id === myMemberId ? Object.entries(mySwipes).filter(([, v]) => v === 'yes').map(([id]) => id) : []);
                const yesCount = memberVotes.length;
                const total = sessionRestaurants.length || 1;
                return (
                  <View key={m.id} style={styles.memberVoteRow}>
                    <Image source={{ uri: m.avatar }} style={styles.memberVoteAvatar} contentFit="cover" />
                    <View style={styles.memberVoteInfo}>
                      <Text style={[styles.memberVoteName, { color: Colors.text }]}>{m.name}</Text>
                      <Text style={[styles.memberVoteStat, { color: Colors.textTertiary }]}>
                        Liked {yesCount} of {sessionRestaurants.length}
                      </Text>
                    </View>
                    <View style={styles.memberVoteBarWrap}>
                      <View style={[styles.memberVoteBar, { width: `${(yesCount / total) * 100}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  phaseContent: {
    flex: 1,
  },
  lobbyHeader: {
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
  lobbyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  lobbyHero: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 28,
  },
  lobbyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lobbyHeroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  lobbyHeroSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  membersSection: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  removeMemberBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#B8860B',
  },
  sessionInfo: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 28,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  swipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  swipeHeaderCenter: {
    alignItems: 'center',
  },
  swipeHeaderTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  membersAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.card,
    marginLeft: -4,
  },
  swipeCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    marginLeft: 6,
  },
  friendProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F9E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  friendProgressText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  actionBtnNo: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  actionBtnYes: {
    backgroundColor: Colors.primary,
  },
  resultsPhase: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  winnerCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  winnerCrown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
  },
  winnerLabel: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#B8860B',
  },
  winnerImage: {
    width: '100%',
    height: 200,
  },
  winnerOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: 200,
  },
  winnerContent: {
    padding: 16,
  },
  winnerName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  winnerCuisine: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  winnerVoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  winnerVotes: {
    flexDirection: 'row',
    gap: 4,
  },
  voteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  voteDotYes: {
    backgroundColor: Colors.success,
  },
  voteDotNo: {
    backgroundColor: Colors.border,
  },
  winnerVoteText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  winnerBtn: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  winnerBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  matchesSection: {
    marginBottom: 20,
  },
  matchesSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  matchImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  matchCuisine: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  allResultsSection: {
    marginBottom: 20,
  },
  allResultsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: {
    backgroundColor: '#FFE066',
  },
  rankBadgeSilver: {
    backgroundColor: '#D1D5DB',
  },
  rankBadgeBronze: {
    backgroundColor: '#F0C8A0',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
  },
  rankNumberTop: {
    color: '#1A1A1A',
  },
  rankImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  rankMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  rankRating: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  rankDistance: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  rankVotesWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  rankVoteBar: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  rankVoteFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  rankVoteLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  memberVoteSummary: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  memberVoteTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  memberVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  memberVoteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  memberVoteInfo: {
    flex: 1,
  },
  memberVoteName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  memberVoteStat: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  memberVoteBarWrap: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  memberVoteBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
});

// ─── Add Member Modal ────────────────────────────────────────────────────────

function AddMemberModal({
  visible,
  onClose,
  onAddMember,
  existingMemberIds,
}: {
  visible: boolean;
  onClose: () => void;
  onAddMember: (member: GroupMember) => void;
  existingMemberIds: string[];
}) {
  const Colors = useColors();
  const { isAuthenticated } = useAuth();

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    enabled: isAuthenticated && visible,
    staleTime: 60 * 1000,
    retry: false,
  });

  const availableFriends = friends.filter(f => !existingMemberIds.includes(f.id));

  const handleAddFriend = useCallback((friend: Friend) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddMember({
      id: friend.id,
      name: friend.name,
      avatar: friend.avatarUri ?? FALLBACK_AVATAR,
      completedSwiping: false,
    });
  }, [onAddMember]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={[modalStyles.header, { borderBottomColor: Colors.borderLight }]}>
          <Text style={[modalStyles.title, { color: Colors.text }]}>Add to Group</Text>
          <Pressable onPress={onClose} style={[modalStyles.closeBtn, { backgroundColor: Colors.card }]} accessibilityLabel="Close" accessibilityRole="button">
            <XIcon size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={modalStyles.scrollContent}>
          <View style={modalStyles.section}>
            <Text style={[modalStyles.sectionTitle, { color: Colors.text }]}>Your Friends</Text>
            {friendsLoading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />}
            {!friendsLoading && availableFriends.length === 0 && (
              <Text style={[modalStyles.emptyText, { color: Colors.textTertiary }]}>
                No friends to add yet. Add friends from the Friends tab.
              </Text>
            )}
            {availableFriends.map(friend => (
              <Pressable
                key={friend.id}
                style={[modalStyles.row, { borderBottomColor: Colors.borderLight }]}
                onPress={() => handleAddFriend(friend)}
              >
                <View style={[modalStyles.avatar, { backgroundColor: Colors.primaryLight }]}>
                  {friend.avatarUri
                    ? <Image source={{ uri: friend.avatarUri }} style={modalStyles.avatarImg} contentFit="cover" />
                    : <Text style={[modalStyles.avatarInitial, { color: Colors.primary }]}>{friend.name[0]?.toUpperCase()}</Text>
                  }
                </View>
                <Text style={[modalStyles.rowName, { color: Colors.text }]}>{friend.name}</Text>
                <UserPlus size={18} color={Colors.primary} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 42,
    height: 42,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
