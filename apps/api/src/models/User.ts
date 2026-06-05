import { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'admin' | 'employee';
  status: 'pending' | 'active' | 'rejected';
  lastActive: Date | null;
  refreshTokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'employee'], required: true, default: 'employee' },
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected'],
      required: true,
      default: 'pending',
      index: true,
    },
    lastActive: { type: Date, default: null },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.passwordHash;
    delete ret.refreshTokenVersion;
    delete ret.__v;
    return ret;
  },
});
