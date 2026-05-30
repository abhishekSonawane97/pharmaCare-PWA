import { Schema, model, Document, Types } from 'mongoose';

export interface IMedicine extends Document {
  _id: Types.ObjectId;
  name: string;
  content?: string;
  category?: string;
  type?: 'tab' | 'cap' | 'syrup';
  inStock: boolean;
  purchasePrice?: number;
  mrp?: number;
  discountedPrice?: number;
  addedFrom?: 'manual' | 'bill';
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    content: { type: String, trim: true },
    category: { type: String, trim: true },
    type: { type: String, enum: ['tab', 'cap', 'syrup'] },
    inStock: { type: Boolean, default: true },
    purchasePrice: { type: Number },
    mrp: { type: Number },
    discountedPrice: { type: Number },
    addedFrom: { type: String, enum: ['manual', 'bill'], default: 'manual' },
  },
  { timestamps: true }
);

MedicineSchema.index({ name: 'text', content: 'text' });

export const Medicine = model<IMedicine>('Medicine', MedicineSchema);
