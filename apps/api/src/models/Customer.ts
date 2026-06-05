import { Schema, Document, Types } from 'mongoose';

export interface IMedicineItem {
  medicineName: string;
  dosage?: string;
}

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  altPhone?: string;
  address?: string;
  notes?: string;
  medicines: IMedicineItem[];
  nextDueDate: Date;
  isActive: boolean;
  reminderIgnored: boolean;
  autoReminderSentForCycle: boolean;
  autoReminderSentAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineItemSchema = new Schema<IMedicineItem>(
  {
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },
  },
  { _id: false }
);

export const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    altPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    medicines: { type: [MedicineItemSchema], default: [] },
    nextDueDate: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    reminderIgnored: { type: Boolean, default: false, index: true },
    autoReminderSentForCycle: { type: Boolean, default: false, index: true },
    autoReminderSentAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

CustomerSchema.index({
  isActive: 1,
  reminderIgnored: 1,
  autoReminderSentForCycle: 1,
  nextDueDate: 1,
});
CustomerSchema.index({ name: 'text', phone: 'text' });
