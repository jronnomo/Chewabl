import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  avatarUri?: string;
  pushToken?: string;
  inviteCode: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    avatarUri: { type: String },
    pushToken: { type: String },
    inviteCode: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
