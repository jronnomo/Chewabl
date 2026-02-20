import mongoose, { Document, Schema } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface IFriendship extends Document {
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model<IFriendship>('Friendship', FriendshipSchema);
