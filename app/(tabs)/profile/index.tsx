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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { api } from '../../../services/api';
import { requestNotificationPermissions, registerForPushNotifications } from '../../../services/notifications';
import StaticColors from '../../../constants/colors';
import { useColors } from '../../../context/ThemeContext';

const Colors = StaticColors;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Colors = useColors();
  const { preferences, updatePreferences, favorites, favoritedRestaurants, setLocalAvatar, localAvatarUri, plans } = useApp();
  const { user, signOut, isAuthenticated, updateUser } = useAuth();

  const [avatarLoading, setAvatarLoading] = useState(false);

  const favoriteRestaurants = favoritedRestaurants;

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
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAvatarLoading(true);
    try {
      // Optimistic: show local preview immediately
      await setLocalAvatar(asset.uri);

      // Upload to Cloudinary via backend if authenticated
      if (isAuthenticated && asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${asset.base64}`;
        const res = await api.post<{ avatarUri: string }>('/uploads/avatar', { image: dataUri });
        updateUser({ avatarUri: res.avatarUri });
        // Persist Cloudinary URL locally so it survives without network
        await setLocalAvatar(res.avatarUri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload profile picture. Your local preview is still saved.');
    } finally {
      setAvatarLoading(false);
    }
  }, [setLocalAvatar, isAuthenticated, updateUser]);

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
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      registerForPushNotifications();
    }
    // TODO: When turning off, clear pushToken from backend (needs DELETE /users/push-token endpoint)
    updatePreferences.mutate({
      ...preferences,
      notificationsEnabled: !preferences.notificationsEnabled,
    });
  }, [preferences, updatePreferences]);

  const handleLogout = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await AsyncStorage.removeItem('chewabl_avatar_uri');
    await signOut();
    router.replace('/auth' as never);
  }, [signOut, router]);

  const displayName = user?.name || preferences.name || 'Foodie';
  const avatarUri = localAvatarUri || user?.avatarUri;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Profile</Text>
          {isAuthenticated && (
            <Pressable
              style={[styles.friendsBtn, { backgroundColor: Colors.primaryLight }]}
              onPress={() => router.push('/(tabs)/friends' as never)}
            >
              <UserPlus size={18} color={Colors.primary} />
              <Text style={[styles.friendsBtnText, { color: Colors.primary }]}>Friends</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.profileCard, { backgroundColor: Colors.card }]}>
          <Pressable style={styles.avatarWrap} onPress={handlePickAvatar} disabled={avatarLoading} accessibilityLabel="Change profile picture" accessibilityRole="button">
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: Colors.primaryLight }]}>
                <User size={32} color={Colors.primary} />
              </View>
            )}
            <View style={[styles.cameraOverlay, { backgroundColor: Colors.primary, borderColor: Colors.card }]}>
              {avatarLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.profileName, { color: Colors.text }]}>{displayName}</Text>
          <Text style={[styles.profileSub, { color: Colors.textSecondary }]}>{user?.email || 'Dining enthusiast'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: Colors.text }]}>{favoriteRestaurants.length}</Text>
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Favorites</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: Colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: Colors.text }]}>{plans.length}</Text>
              <Text style={[styles.statLabel, { color: Colors.textSecondary }]}>Plans</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Preferences</Text>
            <Pressable
              style={[styles.editBtn, { backgroundColor: Colors.primaryLight }]}
              onPress={() => router.push('/(tabs)/profile/edit')}
            >
              <Edit3 size={14} color={Colors.primary} />
              <Text style={[styles.editBtnText, { color: Colors.primary }]}>Edit</Text>
            </Pressable>
          </View>
          <View style={[styles.prefCard, { backgroundColor: Colors.card }]}>
            <PrefRow icon={UtensilsCrossed} label="Cuisines" value={preferences.cuisines.length > 0 ? preferences.cuisines.join(', ') : 'Not set'} />
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <PrefRow icon={DollarSign} label="Budget" value={preferences.budget || 'Not set'} />
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <PrefRow icon={Leaf} label="Dietary" value={preferences.dietary.length > 0 ? preferences.dietary.join(', ') : 'None'} />
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <PrefRow icon={Volume2} label="Atmosphere" value={preferences.atmosphere || 'Not set'} />
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <PrefRow icon={Users} label="Group Size" value={preferences.groupSize || 'Not set'} />
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <PrefRow icon={MapPin} label="Distance" value={preferences.distance ? `${preferences.distance} mi` : 'Not set'} />
          </View>
        </View>

        {favoriteRestaurants.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Favorites</Text>
            {favoriteRestaurants.map(r => (
              <View key={r.id} style={[styles.favoriteItem, { backgroundColor: Colors.card }]}>
                <Heart size={14} color={Colors.primary} fill={Colors.primary} />
                <Text style={[styles.favoriteName, { color: Colors.text }]}>{r.name}</Text>
                <Text style={[styles.favoriteCuisine, { color: Colors.textSecondary }]}>{r.cuisine}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Settings</Text>
          <View style={[styles.prefCard, { backgroundColor: Colors.card }]}>
            <View style={styles.prefRow}>
              <View style={[styles.prefIconCircle, { backgroundColor: Colors.primaryLight }]}>
                <Bell size={16} color={Colors.primary} />
              </View>
              <Text style={[styles.prefLabel, { color: Colors.text }]}>Notifications</Text>
              <Switch
                value={!!preferences.notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#FFF"
                style={{ marginLeft: 'auto' }}
              />
            </View>
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <View style={styles.prefRow}>
              <View style={[styles.prefIconCircle, { backgroundColor: Colors.primaryLight }]}>
                <Moon size={16} color={Colors.primary} />
              </View>
              <Text style={[styles.prefLabel, { color: Colors.text }]}>Dark Mode</Text>
              <Switch
                value={!!preferences.isDarkMode}
                onValueChange={handleToggleDarkMode}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#FFF"
                style={{ marginLeft: 'auto' }}
              />
            </View>
            <View style={[styles.prefDivider, { backgroundColor: Colors.borderLight }]} />
            <Pressable style={styles.prefRow} onPress={handleLogout}>
              <View style={[styles.prefIconCircle, { backgroundColor: `${Colors.error}18` }]}>
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
      <View style={[styles.prefIconCircle, { backgroundColor: Colors.primaryLight }]}>
        <Icon size={16} color={Colors.primary} />
      </View>
      <View style={styles.prefContent}>
        <Text style={[styles.prefLabel, { color: Colors.text }]}>{label}</Text>
        <Text style={[styles.prefValue, { color: Colors.textSecondary }]} numberOfLines={1}>{value}</Text>
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
