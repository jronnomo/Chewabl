import mongoose, { Document, Schema } from 'mongoose';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface IPlanInvite {
  userId: mongoose.Types.ObjectId;
  name: string;
  avatarUri?: string;
  status: InviteStatus;
  respondedAt?: Date;
}

export interface IPlanRestaurant {
  id: string;
  name: string;
  imageUrl: string;
  address: string;
  cuisine: string;
  priceLevel: number;
  rating: number;
}

export interface IPlan extends Document {
  type: 'planned' | 'group-swipe';
  title: string;
  date?: string;
  time?: string;
  ownerId: mongoose.Types.ObjectId;
  status: 'voting' | 'confirmed' | 'completed' | 'cancelled';
  cuisine: string;
  budget: string;
  restaurant?: IPlanRestaurant;
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

const PlanRestaurantSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    imageUrl: { type: String, required: true },
    address: { type: String, required: true },
    cuisine: { type: String, required: true },
    priceLevel: { type: Number, required: true },
    rating: { type: Number, required: true },
  },
  { _id: false }
);

const PlanSchema = new Schema<IPlan>(
  {
    type: { type: String, enum: ['planned', 'group-swipe'], default: 'planned' },
    title: { type: String, required: true, trim: true },
    date: { type: String },
    time: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['voting', 'confirmed', 'completed', 'cancelled'], default: 'voting' },
    cuisine: { type: String, default: 'Any' },
    budget: { type: String, default: '$$' },
    restaurant: { type: PlanRestaurantSchema },
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
