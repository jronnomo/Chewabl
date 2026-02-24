import mongoose, { Document, Schema } from 'mongoose';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface IPlanInvite {
  userId: mongoose.Types.ObjectId;
  name: string;
  avatarUri?: string;
  status: InviteStatus;
  respondedAt?: Date;
}

export interface IPlan extends Document {
  title: string;
  date: string;
  time: string;
  ownerId: mongoose.Types.ObjectId;
  status: 'voting' | 'confirmed' | 'completed' | 'cancelled';
  cuisine: string;
  budget: string;
  invites: IPlanInvite[];
  rsvpDeadline?: Date;
  options: string[];
  votes: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

const PlanInviteSchema = new Schema<IPlanInvite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    avatarUri: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    respondedAt: { type: Date },
  },
  { _id: false }
);

const PlanSchema = new Schema<IPlan>(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['voting', 'confirmed', 'completed', 'cancelled'], default: 'voting' },
    cuisine: { type: String, default: 'Any' },
    budget: { type: String, default: '$$' },
    invites: { type: [PlanInviteSchema], default: [] },
    rsvpDeadline: { type: Date },
    options: { type: [String], default: [] },
    votes: { type: Map, of: [String], default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      // F-005-017: Convert Mongoose Map to plain object for votes field
      transform: (_doc: IPlan, ret: Record<string, unknown>) => {
        if (ret.votes instanceof Map) {
          ret.votes = Object.fromEntries(ret.votes);
        }
        return ret;
      },
    },
  }
);

export default mongoose.model<IPlan>('Plan', PlanSchema);
