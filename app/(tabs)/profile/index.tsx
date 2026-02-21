import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  User,
  Heart,
  UtensilsCrossed,
  DollarSign,
  Leaf,
  Volume2,
  Users,
  Bell,
  Moon,
  ChevronRight,
  LogOut,
  MapPin,
  Edit3,
  UserPlus,
  Camera,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { updateProfile } from '../../../services/auth';
import { requestNotificationPermissions, registerForPushNotifications } from '../../../services/notifications';
import { restaurants } from '../../../mocks/restaurants';
import StaticColors from '../../../constants/colors';
import { useColors } from '../../../context/ThemeContext';

const Colors = StaticColors;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const { preferences, updatePreferences, favorites, setLocalAvatar, localAvatarUri } = useApp();
  const { user, signOut, updateUser, isAuthenticated } = useAuth();

  const [avatarLoading, setAvatarLoading] = useState(false);

  const favoriteRestaurants = restaurants.filter(r => favorites.includes(r.id));

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setAvatarLoading(true);
    try {
      await setLocalAvatar(uri);
      if (isAuthenticated) {
        const updated = await updateProfile({ avatarUri: uri });
        updateUser({ avatarUri: updated.avatarUri });
      } else {
        updateUser({ avatarUri: uri });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile picture.');
    } finally {
      setAvatarLoading(false);
    }
  }, [isAuthenticated, updateUser, setLocalAvatar]);

  const handleToggleDarkMode = useCallback(() => {
    Haptics.selectionAsync();
    updatePreferences.mutate({
      ...preferences,
      isDarkMode: !preferences.isDarkMode,
    });
  }, [preferences, updatePreferences]);

  const handleToggleNotifications = useCallback(async () => {
    Haptics.selectionAsync();
    if (!preferences.notificationsEnabled) {
      // Turning ON — request permission first
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in your device Settings.');
        return;
      }
      registerForPushNotifications();
    }
    updatePreferences.mutate({
      ...preferences,
      notificationsEnabled: !preferences.notificationsEnabled,
    });
  }, [preferences, updatePreferences]);

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  }, [signOut, router]);

  const displayName = user?.name || preferences.name || 'Foodie';
  const avatarUri = user?.avatarUri || localAvatarUri;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          {isAuthenticated && (
            <Pressable
              style={styles.friendsBtn}
              onPress={() => router.push('/friends')}
            >
              <UserPlus size={18} color={Colors.primary} />
              <Text style={styles.friendsBtnText}>Friends</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.profileCard}>
          <Pressable style={styles.avatarWrap} onPress={handlePickAvatar} disabled={avatarLoading}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarCircle}>
                <User size={32} color={Colors.primary} />
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {avatarLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
              )}
            </View>
          </Pressable>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileSub}>{user?.email || 'Dining enthusiast'}</Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push('/(tabs)/profile/edit')}
            >
              <Edit3 size={14} color={Colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
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
            <View style={styles.prefRow}>
              <View style={styles.prefIconCircle}>
                <Bell size={16} color={Colors.primary} />
              </View>
              <Text style={styles.prefLabel}>Notifications</Text>
              <Switch
                value={!!preferences.notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#FFF"
                style={{ marginLeft: 'auto' }}
              />
            </View>
            <View style={styles.prefDivider} />
            <View style={styles.prefRow}>
              <View style={styles.prefIconCircle}>
                <Moon size={16} color={Colors.primary} />
              </View>
              <Text style={styles.prefLabel}>Dark Mode</Text>
              <Switch
                value={!!preferences.isDarkMode}
                onValueChange={handleToggleDarkMode}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#FFF"
                style={{ marginLeft: 'auto' }}
              />
            </View>
            <View style={styles.prefDivider} />
            <Pressable style={styles.prefRow} onPress={handleLogout}>
              <View style={[styles.prefIconCircle, { backgroundColor: '#FFEBEE' }]}>
                <LogOut size={16} color={Colors.error} />
              </View>
              <Text style={[styles.prefLabel, { color: Colors.error }]}>Sign Out</Text>
              <ChevronRight size={16} color={Colors.error} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function PrefRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  const Colors = useColors();
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  friendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  friendsBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
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
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
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
