import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
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
import * as Contacts from 'expo-contacts';
import { useQuery } from '@tanstack/react-query';
import SwipeCard from '@/components/SwipeCard';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getFriends, lookupByPhones } from '@/services/friends';
import { restaurants } from '@/mocks/restaurants';
import { Restaurant, GroupMember, SwipeResult, Friend } from '@/types';
import StaticColors from '@/constants/colors';
import { useColors } from '@/context/ThemeContext';

const Colors = StaticColors;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ContactMatch {
  id: string;
  name: string;
  phone: string;
  hasChewabl: boolean;
  avatarUri?: string;
  inviteCode: string;
}

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

const MOCK_MEMBERS: GroupMember[] = [
  { id: 'me', name: 'You', avatar: FALLBACK_AVATAR, completedSwiping: false },
  { id: 'u1', name: 'Sarah M.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', completedSwiping: false },
  { id: 'u2', name: 'Jake R.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', completedSwiping: false },
  { id: 'u3', name: 'Emily K.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100', completedSwiping: false },
];

const generateMockSwipes = (memberIds: string[], restaurantList: Restaurant[], myId: string): Record<string, Record<string, 'yes' | 'no'>> => {
  const swipes: Record<string, Record<string, 'yes' | 'no'>> = {};
  memberIds.forEach(memberId => {
    if (memberId === myId) return;
    swipes[memberId] = {};
    restaurantList.forEach(r => {
      swipes[memberId][r.id] = Math.random() > 0.4 ? 'yes' : 'no';
    });
  });
  return swipes;
};

type Phase = 'lobby' | 'swiping' | 'waiting' | 'results';

export default function GroupSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const params = useLocalSearchParams<{ planId?: string; curveball?: string }>();
  const { preferences, plans } = useApp();
  const { user } = useAuth();

  const sessionRestaurants = useMemo(() => {
    const plan = params.planId ? plans.find(p => p.id === params.planId) : null;
    const allowCurveball = params.curveball === 'true';

    return [...restaurants].filter(r => {
      if (!plan || plan.cuisine === 'Any' || !plan.cuisine) return true;
      if (r.cuisine === plan.cuisine) return true;
      if (allowCurveball && r.lastCallDeal) return true;
      return false;
    }).sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (preferences.cuisines.includes(a.cuisine)) scoreA += 2;
      if (preferences.cuisines.includes(b.cuisine)) scoreB += 2;
      if (a.isOpenNow) scoreA += 1;
      if (b.isOpenNow) scoreB += 1;
      return scoreB - scoreA;
    });
  }, [preferences.cuisines, params.planId, params.curveball, plans]);

  // Derive members from plan invites if available, otherwise fall back to MOCK_MEMBERS
  const initialMembers = useMemo((): GroupMember[] => {
    if (params.planId) {
      const plan = plans.find(p => p.id === params.planId);
      if (plan?.invites && plan.invites.length > 0) {
        const accepted = plan.invites.filter(i => i.status === 'accepted');
        if (accepted.length > 0) {
          const meEntry: GroupMember = {
            id: user?.id ?? 'me',
            name: user?.name ? `${user.name} (You)` : 'You',
            avatar: user?.avatarUri ?? FALLBACK_AVATAR,
            completedSwiping: false,
          };
          const others: GroupMember[] = accepted.map(inv => ({
            id: inv.userId,
            name: inv.name,
            avatar: inv.avatarUri ?? FALLBACK_AVATAR,
            completedSwiping: false,
          }));
          return [meEntry, ...others];
        }
      }
    }
    return MOCK_MEMBERS;
  }, [params.planId, plans, user]);

  const myMemberId = initialMembers[0]?.id ?? 'me';

  const [phase, setPhase] = useState<Phase>('lobby');
  const [members, setMembers] = useState<GroupMember[]>(initialMembers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [mySwipes, setMySwipes] = useState<Record<string, 'yes' | 'no'>>({});
  const [friendSwipes] = useState<Record<string, Record<string, 'yes' | 'no'>>>(
    () => generateMockSwipes(initialMembers.map(m => m.id), sessionRestaurants, myMemberId)
  );
  const [results, setResults] = useState<SwipeResult[]>([]);

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

  const calculateResults = useCallback(() => {
    const allSwipes: Record<string, Record<string, 'yes' | 'no'>> = {
      ...friendSwipes,
      [myMemberId]: mySwipes,
    };

    const resultList: SwipeResult[] = sessionRestaurants.map(r => {
      let yesCount = 0;
      const totalMembers = members.length;
      Object.values(allSwipes).forEach(memberSwipes => {
        if (memberSwipes[r.id] === 'yes') yesCount++;
      });
      return {
        restaurantId: r.id,
        restaurant: r,
        yesCount,
        totalMembers,
        isMatch: yesCount === totalMembers,
      };
    });

    resultList.sort((a, b) => b.yesCount - a.yesCount);
    return resultList;
  }, [friendSwipes, mySwipes, sessionRestaurants, members.length]);

  const handleRemoveMember = useCallback((memberId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

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

  const handleStartSwiping = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setMembers(prev => prev.map(m =>
      m.id !== myMemberId ? { ...m, completedSwiping: true } : m
    ));
    setPhase('swiping');
  }, []);

  const handleSwipeRight = useCallback((restaurant: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMySwipes(prev => ({ ...prev, [restaurant.id]: 'yes' }));
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= sessionRestaurants.length) {
        setTimeout(() => {
          setMembers(prev2 => prev2.map(m =>
            m.id === 'me' ? { ...m, completedSwiping: true } : m
          ));
          const res = calculateResults();
          setResults(res);
          setPhase('results');
        }, 400);
      }
      return next;
    });
  }, [sessionRestaurants.length, calculateResults]);

  const handleSwipeLeft = useCallback((restaurant: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMySwipes(prev => ({ ...prev, [restaurant.id]: 'no' }));
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= sessionRestaurants.length) {
        setTimeout(() => {
          setMembers(prev2 => prev2.map(m =>
            m.id === 'me' ? { ...m, completedSwiping: true } : m
          ));
          const res = calculateResults();
          setResults(res);
          setPhase('results');
        }, 400);
      }
      return next;
    });
  }, [sessionRestaurants.length, calculateResults]);

  const topMatch = results.length > 0 ? results[0] : null;
  const perfectMatches = results.filter(r => r.isMatch);

  if (phase === 'lobby') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <Animated.View style={[styles.phaseContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.lobbyHeader}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.lobbyTitle}>Group Swipe</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.lobbyHero}>
            <View style={styles.lobbyIconWrap}>
              <Utensils size={32} color={Colors.primary} />
            </View>
            <Text style={styles.lobbyHeroTitle}>Swipe Together</Text>
            <Text style={styles.lobbyHeroSub}>
              Everyone swipes on restaurants. The group's top match wins!
            </Text>
          </View>

          <View style={styles.membersSection}>
            <View style={styles.membersSectionHeader}>
              <Users size={16} color={Colors.textSecondary} />
              <Text style={styles.membersSectionTitle}>
                {members.length} members
              </Text>
            </View>
            {members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <Image source={{ uri: member.avatar }} style={styles.memberAvatar} contentFit="cover" />
                <Text style={styles.memberName}>{member.name}</Text>
                {member.id === myMemberId ? (
                  <View style={styles.hostBadge}>
                    <Crown size={11} color="#B8860B" />
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.removeMemberBtn}
                    onPress={() => handleRemoveMember(member.id)}
                    hitSlop={8}
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

          <View style={styles.sessionInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Restaurants</Text>
              <Text style={styles.infoValue}>{sessionRestaurants.length} to swipe</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>How it works</Text>
              <Text style={styles.infoValue}>Swipe right = Yes</Text>
            </View>
          </View>
        </Animated.View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.startBtn} onPress={handleStartSwiping} testID="start-swiping-btn">
            <Text style={styles.startBtnText}>Start Swiping</Text>
            <ChevronRight size={18} color="#FFF" />
          </Pressable>
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

    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <View style={styles.swipeHeader}>
          <Pressable style={styles.backBtn} onPress={() => setPhase('lobby')}>
            <ArrowLeft size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.swipeHeaderCenter}>
            <Text style={styles.swipeHeaderTitle}>Group Swipe</Text>
            <View style={styles.membersAvatarRow}>
              {members.slice(0, 4).map(m => (
                <Image key={m.id} source={{ uri: m.avatar }} style={styles.miniAvatar} contentFit="cover" />
              ))}
              <Text style={styles.swipeCount}>
                {currentIndex}/{sessionRestaurants.length}
              </Text>
            </View>
          </View>
          <View style={styles.friendProgress}>
            <Check size={14} color={Colors.success} />
            <Text style={styles.friendProgressText}>
              {members.filter(m => m.completedSwiping).length}/{members.length}
            </Text>
          </View>
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
                isTop={isTop}
              />
            );
          })}
        </View>

        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnNo]}
            onPress={() => {
              if (currentIndex < sessionRestaurants.length) {
                handleSwipeLeft(sessionRestaurants[currentIndex]);
              }
            }}
          >
            <XIcon size={28} color={Colors.error} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnYes]}
            onPress={() => {
              if (currentIndex < sessionRestaurants.length) {
                handleSwipeRight(sessionRestaurants[currentIndex]);
              }
            }}
          >
            <Heart size={28} color="#FFF" fill="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={[styles.resultsPhase, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.resultsHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.resultsTitle}>Results</Text>
          <Pressable style={styles.shareBtn}>
            <Share2 size={18} color={Colors.primary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsScroll}>
          {topMatch && (
            <View style={styles.winnerCard}>
              <View style={styles.winnerCrown}>
                <Crown size={20} color="#FFB800" />
                <Text style={styles.winnerLabel}>
                  {topMatch.isMatch ? 'Perfect Match!' : 'Top Pick'}
                </Text>
              </View>
              <Image
                source={{ uri: topMatch.restaurant.imageUrl }}
                style={styles.winnerImage}
                contentFit="cover"
              />
              <View style={styles.winnerOverlay} />
              <View style={styles.winnerContent}>
                <Text style={styles.winnerName}>{topMatch.restaurant.name}</Text>
                <Text style={styles.winnerCuisine}>
                  {topMatch.restaurant.cuisine} · {'$'.repeat(topMatch.restaurant.priceLevel)}
                </Text>
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
                  <Text style={styles.winnerVoteText}>
                    {topMatch.yesCount}/{topMatch.totalMembers} said yes
                  </Text>
                </View>
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

          {perfectMatches.length > 1 && (
            <View style={styles.matchesSection}>
              <Text style={styles.matchesSectionTitle}>All Perfect Matches</Text>
              {perfectMatches.map(m => (
                <Pressable
                  key={m.restaurantId}
                  style={styles.matchCard}
                  onPress={() => router.push(`/restaurant/${m.restaurantId}` as never)}
                >
                  <Image source={{ uri: m.restaurant.imageUrl }} style={styles.matchImage} contentFit="cover" />
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName}>{m.restaurant.name}</Text>
                    <Text style={styles.matchCuisine}>{m.restaurant.cuisine}</Text>
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
            <Text style={styles.allResultsTitle}>All Rankings</Text>
            {results.map((r, i) => (
              <Pressable
                key={r.restaurantId}
                style={styles.rankCard}
                onPress={() => router.push(`/restaurant/${r.restaurantId}` as never)}
              >
                <View style={[
                  styles.rankBadge,
                  i === 0 && styles.rankBadgeGold,
                  i === 1 && styles.rankBadgeSilver,
                  i === 2 && styles.rankBadgeBronze,
                ]}>
                  <Text style={[
                    styles.rankNumber,
                    i < 3 && styles.rankNumberTop,
                  ]}>
                    {i + 1}
                  </Text>
                </View>
                <Image source={{ uri: r.restaurant.imageUrl }} style={styles.rankImage} contentFit="cover" />
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName} numberOfLines={1}>{r.restaurant.name}</Text>
                  <View style={styles.rankMeta}>
                    <Star size={11} color={Colors.star} fill={Colors.star} />
                    <Text style={styles.rankRating}>{r.restaurant.rating}</Text>
                    <MapPin size={11} color={Colors.textTertiary} />
                    <Text style={styles.rankDistance}>{r.restaurant.distance}</Text>
                  </View>
                </View>
                <View style={styles.rankVotesWrap}>
                  <View style={styles.rankVoteBar}>
                    <View style={[styles.rankVoteFill, { width: `${(r.yesCount / r.totalMembers) * 100}%` }]} />
                  </View>
                  <Text style={styles.rankVoteLabel}>{r.yesCount}/{r.totalMembers}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.memberVoteSummary}>
            <Text style={styles.memberVoteTitle}>Who voted what</Text>
            {members.map(m => {
              const memberSwipeData = m.id === myMemberId ? mySwipes : (friendSwipes[m.id] ?? {});
              const yesCount = Object.values(memberSwipeData).filter(v => v === 'yes').length;
              return (
                <View key={m.id} style={styles.memberVoteRow}>
                  <Image source={{ uri: m.avatar }} style={styles.memberVoteAvatar} contentFit="cover" />
                  <View style={styles.memberVoteInfo}>
                    <Text style={styles.memberVoteName}>{m.name}</Text>
                    <Text style={styles.memberVoteStat}>
                      Liked {yesCount} of {sessionRestaurants.length}
                    </Text>
                  </View>
                  <View style={styles.memberVoteBarWrap}>
                    <View style={[styles.memberVoteBar, { width: `${(yesCount / sessionRestaurants.length) * 100}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>

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
    paddingVertical: 16,
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
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [showContacts, setShowContacts] = useState(false);

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    enabled: isAuthenticated && visible,
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

  const handleOpenContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow contacts access in Settings.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const phones: string[] = [];
      const contactMap: Record<string, { name: string }> = {};
      for (const contact of data) {
        for (const p of (contact.phoneNumbers ?? [])) {
          if (p.number) {
            const digits = p.number.replace(/\D/g, '');
            const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
            if (!contactMap[e164]) {
              phones.push(e164);
              contactMap[e164] = { name: contact.name ?? p.number };
            }
          }
        }
      }
      let matches: ContactMatch[] = [];
      try {
        const found = await lookupByPhones(phones.slice(0, 100));
        matches = found.map(u => ({
          id: u.id,
          name: u.name,
          phone: u.phone ?? '',
          hasChewabl: true,
          avatarUri: u.avatarUri,
          inviteCode: u.inviteCode,
        }));
        // Also add contacts that weren't found
        const foundPhones = new Set(found.map(u => u.phone));
        for (const [phone, c] of Object.entries(contactMap).slice(0, 30)) {
          if (!foundPhones.has(phone) && !matches.find(m => m.phone === phone)) {
            matches.push({ id: `contact_${phone}`, name: c.name, phone, hasChewabl: false, inviteCode: '' });
          }
        }
      } catch {
        // Backend unavailable — show contacts as invitable
        matches = Object.entries(contactMap).slice(0, 30).map(([phone, c]) => ({
          id: `contact_${phone}`,
          name: c.name,
          phone,
          hasChewabl: false,
          inviteCode: '',
        }));
      }
      setContactMatches(matches);
      setShowContacts(true);
    } catch {
      Alert.alert('Error', 'Could not access contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const handleContactTap = useCallback((match: ContactMatch) => {
    if (match.hasChewabl && !existingMemberIds.includes(match.id)) {
      onAddMember({ id: match.id, name: match.name, avatar: match.avatarUri ?? FALLBACK_AVATAR, completedSwiping: false });
    } else if (!match.hasChewabl) {
      Alert.alert('Invite Sent', `${match.name} will receive an invitation to join Chewabl.`);
    }
  }, [onAddMember, existingMemberIds]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={modalStyles.header}>
          <Text style={[modalStyles.title, { color: Colors.text }]}>Add to Group</Text>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <XIcon size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={modalStyles.scrollContent}>
          {isAuthenticated && (
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
          )}

          {!showContacts ? (
            <Pressable
              style={[modalStyles.contactsBtn, { backgroundColor: Colors.card, borderColor: Colors.border }]}
              onPress={handleOpenContacts}
              disabled={contactsLoading}
            >
              {contactsLoading
                ? <ActivityIndicator color={Colors.primary} />
                : <>
                  <Users size={18} color={Colors.primary} />
                  <Text style={[modalStyles.contactsBtnText, { color: Colors.primary }]}>Add from Contacts</Text>
                </>
              }
            </Pressable>
          ) : (
            <View style={modalStyles.section}>
              <Text style={[modalStyles.sectionTitle, { color: Colors.text }]}>Contacts</Text>
              {contactMatches.map(match => (
                <Pressable
                  key={match.id}
                  style={[modalStyles.row, { borderBottomColor: Colors.borderLight }]}
                  onPress={() => handleContactTap(match)}
                >
                  <View style={[modalStyles.avatar, { backgroundColor: Colors.primaryLight }]}>
                    {match.avatarUri
                      ? <Image source={{ uri: match.avatarUri }} style={modalStyles.avatarImg} contentFit="cover" />
                      : <Text style={[modalStyles.avatarInitial, { color: Colors.primary }]}>{match.name[0]?.toUpperCase()}</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.rowName, { color: Colors.text }]}>{match.name}</Text>
                    {!match.hasChewabl && (
                      <Text style={[modalStyles.rowSub, { color: Colors.textTertiary }]}>Not on Chewabl yet</Text>
                    )}
                  </View>
                  <Text style={[modalStyles.actionLabel, { color: match.hasChewabl ? Colors.primary : Colors.secondary }]}>
                    {match.hasChewabl ? (existingMemberIds.includes(match.id) ? 'Added' : 'Add') : 'Invite'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  contactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  contactsBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
