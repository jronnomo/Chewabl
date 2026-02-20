import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Heart,
  UtensilsCrossed,
  DollarSign,
  Leaf,
  Volume2,
  Users,
  Bell,
  Settings,
  ChevronRight,
  LogOut,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../../context/AppContext';
import { restaurants } from '../../../mocks/restaurants';
import Colors from '../../../constants/colors';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { preferences, favorites } = useApp();

  const favoriteRestaurants = restaurants.filter(r => favorites.includes(r.id));

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => console.log('Signed out') },
    ]);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <User size={32} color={Colors.primary} />
          </View>
          <Text style={styles.profileName}>{preferences.name || 'Foodie'}</Text>
          <Text style={styles.profileSub}>Dining enthusiast</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{favoriteRestaurants.length}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>Plans</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefCard}>
            <PrefRow icon={UtensilsCrossed} label="Cuisines" value={preferences.cuisines.length > 0 ? preferences.cuisines.join(', ') : 'Not set'} />
            <View style={styles.prefDivider} />
            <PrefRow icon={DollarSign} label="Budget" value={preferences.budget || 'Not set'} />
            <View style={styles.prefDivider} />
            <PrefRow icon={Leaf} label="Dietary" value={preferences.dietary.length > 0 ? preferences.dietary.join(', ') : 'None'} />
            <View style={styles.prefDivider} />
            <PrefRow icon={Volume2} label="Atmosphere" value={preferences.atmosphere || 'Not set'} />
            <View style={styles.prefDivider} />
            <PrefRow icon={Users} label="Group Size" value={preferences.groupSize || 'Not set'} />
            <View style={styles.prefDivider} />
            <PrefRow icon={MapPin} label="Distance" value={preferences.distance ? `${preferences.distance} mi` : 'Not set'} />
          </View>
        </View>

        {favoriteRestaurants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorites</Text>
            {favoriteRestaurants.map(r => (
              <View key={r.id} style={styles.favoriteItem}>
                <Heart size={14} color={Colors.primary} fill={Colors.primary} />
                <Text style={styles.favoriteName}>{r.name}</Text>
                <Text style={styles.favoriteCuisine}>{r.cuisine}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.prefCard}>
            <SettingsRow icon={Bell} label="Notifications" />
            <View style={styles.prefDivider} />
            <SettingsRow icon={Settings} label="App Settings" />
            <View style={styles.prefDivider} />
            <Pressable style={styles.prefRow} onPress={handleLogout}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#FFEBEE' }]}>
                <LogOut size={16} color={Colors.error} />
              </View>
              <Text style={[styles.prefLabel, { color: Colors.error }]}>Sign Out</Text>
              <ChevronRight size={16} color={Colors.error} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function PrefRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefIconCircle}>
        <Icon size={16} color={Colors.primary} />
      </View>
      <View style={styles.prefContent}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function SettingsRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <Pressable style={styles.prefRow}>
      <View style={styles.prefIconCircle}>
        <Icon size={16} color={Colors.primary} />
      </View>
      <Text style={styles.prefLabel}>{label}</Text>
      <ChevronRight size={16} color={Colors.textTertiary} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  profileSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 0,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  prefCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  prefIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefContent: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  prefValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  prefDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 58,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  favoriteName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  favoriteCuisine: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
