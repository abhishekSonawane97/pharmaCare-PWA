import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorName: string;
  action: string;
  targetType?: 'customer' | 'employee' | 'payment' | 'medicine';
  targetId?: Types.ObjectId;
  targetName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, enum: ['customer', 'employee', 'payment', 'medicine'] },
    targetId: { type: Schema.Types.ObjectId },
    targetName: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ actorId: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', ActivityLogSchema);
