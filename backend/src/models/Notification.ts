import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'plan_invite'
  | 'group_swipe_invite'
  | 'rsvp_response'
  | 'group_swipe_result'
  | 'swipe_completed'
  | 'friend_request'
  | 'friend_accepted'
  | 'plan_reminder';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['plan_invite', 'group_swipe_invite', 'rsvp_response', 'group_swipe_result', 'swipe_completed', 'friend_request', 'friend_accepted', 'plan_reminder'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
