import { Schema, model, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId | null;
  type: 'received' | 'given';
  amount: number; // paise
  date: Date;
  notes?: string;
  walkIn: boolean;
  walkInName?: string;
  walkInPhone?: string;
  due: boolean;
  recordedBy: Types.ObjectId;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    type: { type: String, enum: ['received', 'given'], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, index: true },
    notes: { type: String, trim: true },
    walkIn: { type: Boolean, default: false },
    walkInName: { type: String, trim: true },
    walkInPhone: { type: String, trim: true },
    due: { type: Boolean, default: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PaymentSchema.index({ date: -1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
