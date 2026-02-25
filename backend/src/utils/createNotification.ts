import Notification, { NotificationType } from '../models/Notification';
import User from '../models/User';
import { sendPushNotification, sendPushToMany } from './pushNotifications';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function createNotification({ userId, type, title, body, data }: CreateNotificationParams): Promise<void> {
  await Notification.create({ userId, type, title, body, data: data ?? {} });

  try {
    const user = await User.findById(userId).select('pushToken');
    if (user?.pushToken) {
      await sendPushNotification(user.pushToken, title, body, { type, ...data });
    }
  } catch (err) {
    console.error('Push notification failed (non-blocking):', err);
  }
}

export async function createNotificationForMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;

  const docs = userIds.map(userId => ({
    userId,
    type,
    title,
    body,
    data: data ?? {},
    read: false,
  }));
  await Notification.insertMany(docs);

  try {
    const users = await User.find({ _id: { $in: userIds } }).select('pushToken');
    const tokens = users.filter(u => u.pushToken).map(u => u.pushToken!);
    if (tokens.length > 0) {
      await sendPushToMany(tokens, title, body, { type, ...data });
    }
  } catch (err) {
    console.error('Batch push notification failed (non-blocking):', err);
  }
}
