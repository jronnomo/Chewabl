# PRD: App Notifications

## Summary

Add a full in-app notification system to Chewabl. Today, push notifications are fire-and-forget — there's no persistent history, no deep linking on tap, no auto-registration of push tokens after auth, no "user finished swiping" notification, and no upcoming plan reminders. This feature fills all those gaps and adds a notification center accessible via a bell icon.

## Problem

1. **No notification history** — Users who miss a push notification have no way to see what they missed.
2. **No deep linking** — Tapping a push notification doesn't navigate to the relevant screen.
3. **Push tokens never registered** — `registerForPushNotifications()` exists but is never called; no user actually receives pushes.
4. **Missing notification types** — No "user finished swiping" alert for group swipe participants, and no plan reminder before an event.
5. **No unread indicator** — No visual cue that new notifications are waiting.

## Goals

- Persist every push notification as an in-app record (dual-write: DB + push)
- Provide a notification center screen with unread badges
- Deep link to the relevant screen on notification tap
- Auto-register push tokens after sign-in / sign-up
- Add "swipe completed" notification for group swipe participants
- Schedule local plan reminders 1 hour before plan time

## Scope

| Capability | Status | Work Needed |
|------------|--------|-------------|
| Push for plan invites / RSVPs / results / friends | Exists | Refactor to dual-write (push + DB) |
| "User finished swiping" push | Missing | New push in swipe endpoint |
| In-app notification list (bell icon + screen) | Missing | New backend model/API + new frontend screen |
| Deep linking on notification tap | Missing | New handler in _layout.tsx |
| Auto push token registration after auth | Missing | Wire into AuthContext signIn/signUp |
| Upcoming plan reminders (local) | Missing | Local scheduled notifications via expo-notifications |

## Notification Types & Deep Link Targets

| Type | Trigger | Deep Link Target |
|------|---------|-----------------|
| `plan_invite` | Plan created with invitees | Plan detail |
| `group_swipe_invite` | Group swipe created | Group session |
| `rsvp_response` | Invitee accepts/declines | Plan detail |
| `group_swipe_result` | All voted, winner picked | Plan detail |
| `swipe_completed` | One participant finishes swiping | Plan detail |
| `friend_request` | Friend request sent | Friends screen (Requests tab) |
| `friend_accepted` | Friend request accepted | Friends screen |
| `plan_reminder` | 1 hour before plan time (local) | Plan detail |

## Backend Changes

### New: Notification Model (`backend/src/models/Notification.ts`)
- Fields: `userId`, `type`, `title`, `body`, `data` (mixed), `read` (boolean), `timestamps`
- Indexed on `userId` for fast queries

### New: createNotification Helper (`backend/src/utils/createNotification.ts`)
- `createNotification(payload)` — writes DB record first, then sends push (non-blocking)
- `createNotificationForMany(userIds, ...)` — bulk insert + batched push

### New: Notification Routes (`backend/src/routes/notifications.ts`)
- `GET /notifications` — paginated list for current user (newest first)
- `GET /notifications/unread-count` — count of unread notifications
- `PUT /notifications/:id/read` — mark single notification as read
- `PUT /notifications/read-all` — mark all as read
- `DELETE /notifications/:id` — delete single notification

### Modified: plans.ts
- Replace all `sendPushNotification`/`sendPushToMany` with `createNotification`/`createNotificationForMany`
- Add `swipe_completed` notification when a user finishes swiping (notify other participants)

### Modified: friends.ts
- Replace all `sendPushNotification` with `createNotification`

## Frontend Changes

### New: AppNotification Type (`types/index.ts`)
```ts
type NotificationType = 'plan_invite' | 'group_swipe_invite' | 'rsvp_response' | 'group_swipe_result' | 'swipe_completed' | 'friend_request' | 'friend_accepted' | 'plan_reminder';

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
```

### New: Notification API Service (`services/notifications.ts`)
- `getNotifications(page, limit)` — paginated fetch
- `getUnreadCount()` — returns `{ count: number }`
- `markNotificationRead(id)` — PUT mark-read
- `markAllNotificationsRead()` — PUT mark-all-read
- `deleteNotification(id)` — DELETE

### New: Notification Hooks (`hooks/useNotifications.ts`)
- `useNotifications()` — React Query infinite query with pull-to-refresh
- `useUnreadCount()` — polling every 30 seconds
- `useMarkRead()` — mutation
- `useMarkAllRead()` — mutation
- `useDeleteNotification()` — optimistic mutation

### New: Notifications Screen (`app/notifications.tsx`)
- FlatList with pull-to-refresh and infinite scroll
- Swipe-to-delete gesture
- "Mark all as read" button in header
- Empty state with illustration
- Full dark mode compliance

### New: NotificationItem Component (`components/NotificationItem.tsx`)
- Type-based icon (calendar for plan, users for friend, etc.)
- Read/unread visual distinction (bold title + accent left border for unread)
- Tap to navigate (deep link) + mark as read
- Swipe-to-delete with red background

### Modified: Home Screen Header
- Add bell icon with unread badge count next to greeting

### Modified: _layout.tsx
- Add `NotificationHandler` component for deep link navigation on notification tap
- Register `notifications` screen in Stack

### Modified: AuthContext
- Call `registerForPushNotifications()` after successful signIn/signUp

## Key Architectural Decisions

1. **Dual-write helper**: Every push notification also persists a Notification document. DB write first, push second. Push failures are non-blocking.
2. **30-second polling** for unread badge count (pragmatic v1; WebSocket can come later).
3. **Bell icon** in home screen greeting header area (inline, not a nav header).
4. **Deep link handler**: `NotificationHandler` component rendered inside provider tree in `_layout.tsx`, uses `useRouter()` + `addNotificationResponseReceivedListener`.
5. **Local reminders**: `Notifications.scheduleNotificationAsync` with trigger 1 hour before plan time; IDs stored in AsyncStorage keyed by planId.

## Verification Criteria

1. `npx tsc --noEmit` — 0 TypeScript errors
2. `cd backend && npm test` — all existing + new notification tests pass
3. Dark mode checklist passes on all new/modified screens
4. All notification types create DB records AND send pushes
5. Bell icon shows correct unread count with 30s polling
6. Tapping a notification navigates to the correct screen
7. Push tokens auto-registered after sign-in/sign-up
