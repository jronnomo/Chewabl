import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { CalendarDays, Users, Check, Vote, Clock, X, Pencil } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DiningPlan } from '../types';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

interface PlanCardProps {
  plan: DiningPlan;
  onPress?: () => void;
  onEdit?: () => void;
  onRestaurantPress?: () => void;
}

const statusConfigStatic = {
  voting: { label: 'Voting', icon: Vote },
  confirmed: { label: 'Restaurant Set', icon: Check },
  completed: { label: 'Completed', icon: Clock },
  cancelled: { label: 'Cancelled', icon: X },
};

function getStatusColors(status: string, Colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'voting':
      return { color: Colors.secondary, bg: Colors.secondaryLight };
    case 'confirmed':
      return { color: Colors.success, bg: Colors.success + '18' };
    case 'completed':
      return { color: Colors.textTertiary, bg: Colors.textTertiary + '18' };
    case 'cancelled':
      return { color: Colors.error, bg: Colors.error + '18' };
    default:
      return { color: Colors.textTertiary, bg: Colors.textTertiary + '18' };
  }
}

function PlanCardFooter({ plan }: { plan: DiningPlan }) {
  const Colors = useColors(); // F-005-001: Module-level helper needs its own useColors()
  // Prefer the backend invites shape; fall back to legacy invitees
  if (plan.invites !== undefined) {
    const accepted = plan.invites.filter(i => i.status === 'accepted').length;
    const pending = plan.invites.filter(i => i.status === 'pending').length;
    return (
      <View style={[styles.footer, { borderTopColor: Colors.borderLight }]}>
        <View style={styles.avatarsRow}>
          {plan.invites.slice(0, 4).map((invite, i) => (
            <View
              key={invite.userId}
              style={[
                styles.avatarContainer,
                { borderColor: Colors.card },
                i > 0 && { marginLeft: -8 },
                invite.status === 'accepted' && styles.avatarAccepted,
                invite.status === 'declined' && styles.avatarDeclined,
              ]}
            >
              {invite.avatarUri ? (
                <Image source={{ uri: invite.avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.avatarInitial, { color: Colors.primary }]}>{invite.name[0]?.toUpperCase()}</Text>
                </View>
              )}
            </View>
          ))}
          {plan.invites.length > 4 && (
            <View style={[styles.avatarContainer, { marginLeft: -8, backgroundColor: Colors.primaryLight }]}>
              <Text style={[styles.moreText, { color: Colors.primary }]}>+{plan.invites.length - 4}</Text>
            </View>
          )}
        </View>
        <View style={styles.inviteeInfo}>
          <Users size={13} color={Colors.textSecondary} />
          <Text style={[styles.inviteeText, { color: Colors.textSecondary }]}>
            {accepted}/{plan.invites.length} accepted{pending > 0 ? ` · ${pending} pending` : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Legacy invitees fallback
  const legacyInvitees = plan.invitees ?? [];
  if (legacyInvitees.length === 0) return null;
  return (
    <View style={[styles.footer, { borderTopColor: Colors.borderLight }]}>
      <View style={styles.avatarsRow}>
        {legacyInvitees.slice(0, 4).map((invitee, i) => (
          <View key={invitee.id} style={[styles.avatarContainer, { borderColor: Colors.card }, i > 0 && { marginLeft: -8 }]}>
            <Image source={{ uri: invitee.avatar }} style={styles.avatar} contentFit="cover" />
          </View>
        ))}
        {legacyInvitees.length > 4 && (
          <View style={[styles.avatarContainer, { marginLeft: -8, backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.moreText, { color: Colors.primary }]}>+{legacyInvitees.length - 4}</Text>
          </View>
        )}
      </View>
      <View style={styles.inviteeInfo}>
        <Users size={13} color={Colors.textSecondary} />
        <Text style={[styles.inviteeText, { color: Colors.textSecondary }]}>{legacyInvitees.length} people</Text>
      </View>
    </View>
  );
}

export default React.memo(function PlanCard({ plan, onPress, onEdit, onRestaurantPress }: PlanCardProps) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const configStatic = statusConfigStatic[plan.status];
  const statusColors = getStatusColors(plan.status, Colors);
  const StatusIcon = configStatic.icon;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  const formattedDate = plan.date
    ? new Date(plan.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} testID={`plan-card-${plan.id}`}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], backgroundColor: Colors.card }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: Colors.text }]} numberOfLines={1}>{plan.title}</Text>
            <View style={styles.titleRowRight}>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <StatusIcon size={11} color={statusColors.color} />
                <Text style={[styles.statusText, { color: statusColors.color }]}>{configStatic.label}</Text>
              </View>
              {onEdit && (
                <Pressable
                  style={[styles.editBtn, { backgroundColor: Colors.surfaceElevated }]}
                  onPress={e => { e.stopPropagation?.(); onEdit(); }}
                  hitSlop={8}
                  accessibilityLabel="Edit plan"
                  accessibilityRole="button"
                >
                  <Pencil size={14} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.metaRow}>
            {plan.type === 'group-swipe' ? (
              <>
                <Users size={13} color={Colors.textSecondary} />
                <Text style={[styles.metaText, { color: Colors.textSecondary }]}>Group Decision</Text>
              </>
            ) : (
              <>
                <CalendarDays size={13} color={Colors.textSecondary} />
                <Text style={[styles.metaText, { color: Colors.textSecondary }]}>{formattedDate}{plan.time ? ` at ${plan.time}` : ''}</Text>
              </>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.cuisineTag, { color: Colors.primary, backgroundColor: Colors.primaryLight }]}>{plan.cuisine}</Text>
            <Text style={[styles.budgetTag, { color: Colors.secondary, backgroundColor: Colors.secondaryLight }]}>{plan.budget}</Text>
          </View>
        </View>

        {plan.restaurant && (
          <Pressable
            onPress={e => { e.stopPropagation?.(); onRestaurantPress?.(); }}
            disabled={!onRestaurantPress}
          >
            <View style={[styles.restaurantPreview, { backgroundColor: Colors.surfaceElevated }]}>
              <Image source={{ uri: plan.restaurant.imageUrl }} style={styles.restaurantImage} contentFit="cover" />
              <View style={styles.restaurantInfo}>
                <Text style={[styles.restaurantName, { color: Colors.text }]} numberOfLines={1}>{plan.restaurant.name}</Text>
                <Text style={[styles.restaurantAddress, { color: Colors.textSecondary }]}>{plan.restaurant.address}</Text>
              </View>
            </View>
          </Pressable>
        )}

        <PlanCardFooter plan={plan} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cuisineTag: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  budgetTag: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.secondary,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  restaurantPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
  },
  restaurantImage: {
    width: 56,
    height: 56,
  },
  restaurantInfo: {
    flex: 1,
    padding: 10,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  restaurantAddress: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  avatarsRow: {
    flexDirection: 'row',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  moreText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  avatarAccepted: {
    borderColor: Colors.success,
  },
  avatarDeclined: {
    opacity: 0.4,
  },
  avatarFallback: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  inviteeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inviteeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
