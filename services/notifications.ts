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
    await registerPushToken(token.data);
    return token.data;
  } catch (err) {
    console.error('[Push] Failed to get push token:', err);
    return null;
  }
}

export function configurePushHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
