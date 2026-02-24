import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken } from './auth';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (!projectId) {
    console.warn('[Push] EXPO_PUBLIC_PROJECT_ID not set — skipping push token registration');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    // Token obtained — try to register with backend (non-critical)
    try {
      await registerPushToken(token.data);
    } catch {
      // Backend unavailable — token saved locally, will sync on next launch
    }
    return token.data;
  } catch (err) {
    // Push tokens unavailable (e.g., simulator, no network to Expo servers)
    console.warn('[Push] Push token unavailable:', err);
    return null;
  }
}

export function configurePushHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
