import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { CalendarDays, Users, Check, Vote, Clock, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DiningPlan } from '../types';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

interface PlanCardProps {
  plan: DiningPlan;
  onPress?: () => void;
}

const statusConfig = {
  voting: { label: 'Voting', color: Colors.secondary, icon: Vote, bg: Colors.secondaryLight },
  confirmed: { label: 'Confirmed', color: Colors.success, icon: Check, bg: '#E8F9EE' },
  completed: { label: 'Completed', color: Colors.textTertiary, icon: Clock, bg: '#F0F0F0' },
  cancelled: { label: 'Cancelled', color: Colors.error, icon: X, bg: '#FFEBEE' },
};

function PlanCardFooter({ plan }: { plan: DiningPlan }) {
  // Prefer the backend invites shape; fall back to legacy invitees
  if (plan.invites && plan.invites.length > 0) {
    const accepted = plan.invites.filter(i => i.status === 'accepted').length;
    const pending = plan.invites.filter(i => i.status === 'pending').length;
    return (
      <View style={styles.footer}>
        <View style={styles.avatarsRow}>
          {plan.invites.slice(0, 4).map((invite, i) => (
            <View
              key={invite.userId}
              style={[
                styles.avatarContainer,
                i > 0 && { marginLeft: -8 },
                invite.status === 'accepted' && styles.avatarAccepted,
                invite.status === 'declined' && styles.avatarDeclined,
              ]}
            >
              {invite.avatarUri ? (
                <Image source={{ uri: invite.avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{invite.name[0]?.toUpperCase()}</Text>
                </View>
              )}
            </View>
          ))}
          {plan.invites.length > 4 && (
            <View style={[styles.avatarContainer, { marginLeft: -8, backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.moreText}>+{plan.invites.length - 4}</Text>
            </View>
          )}
        </View>
        <View style={styles.inviteeInfo}>
          <Users size={13} color={Colors.textSecondary} />
          <Text style={styles.inviteeText}>
            {accepted}/{plan.invites.length} accepted{pending > 0 ? ` · ${pending} pending` : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Legacy invitees fallback
  return (
    <View style={styles.footer}>
      <View style={styles.avatarsRow}>
        {plan.invitees.slice(0, 4).map((invitee, i) => (
          <View key={invitee.id} style={[styles.avatarContainer, i > 0 && { marginLeft: -8 }]}>
            <Image source={{ uri: invitee.avatar }} style={styles.avatar} contentFit="cover" />
          </View>
        ))}
        {plan.invitees.length > 4 && (
          <View style={[styles.avatarContainer, { marginLeft: -8, backgroundColor: Colors.primaryLight }]}>
            <Text style={styles.moreText}>+{plan.invitees.length - 4}</Text>
          </View>
        )}
      </View>
      <View style={styles.inviteeInfo}>
        <Users size={13} color={Colors.textSecondary} />
        <Text style={styles.inviteeText}>{plan.invitees.length} people</Text>
      </View>
    </View>
  );
}

export default React.memo(function PlanCard({ plan, onPress }: PlanCardProps) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = statusConfig[plan.status];
  const StatusIcon = config.icon;

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

  const formattedDate = new Date(plan.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} testID={`plan-card-${plan.id}`}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{plan.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <StatusIcon size={11} color={config.color} />
              <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <CalendarDays size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{formattedDate} at {plan.time}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.cuisineTag}>{plan.cuisine}</Text>
            <Text style={styles.budgetTag}>{plan.budget}</Text>
          </View>
        </View>

        {plan.restaurant && (
          <View style={styles.restaurantPreview}>
            <Image source={{ uri: plan.restaurant.imageUrl }} style={styles.restaurantImage} contentFit="cover" />
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName} numberOfLines={1}>{plan.restaurant.name}</Text>
              <Text style={styles.restaurantAddress}>{plan.restaurant.address}</Text>
            </View>
          </View>
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
