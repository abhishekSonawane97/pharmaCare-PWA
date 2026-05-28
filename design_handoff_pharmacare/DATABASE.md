# Database — MongoDB Schemas

All schemas use Mongoose. Below are TypeScript interfaces + Mongoose schemas for each collection.

---

## 1. User

```ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'admin' | 'employee';
  status: 'pending' | 'active' | 'rejected';
  lastActive: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone:        { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'employee'], required: true, default: 'employee' },
  status:       { type: String, enum: ['pending', 'active', 'rejected'], required: true, default: 'pending', index: true },
  lastActive:   { type: Date, default: null },
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);
```

**Notes:**
- `email` is unique (case-insensitive — store lowercased).
- First-ever signup auto-becomes `role: 'admin', status: 'active'`. All subsequent: `role: 'employee', status: 'pending'`.
- `passwordHash` = bcrypt with 10+ rounds.

---

## 2. Customer

```ts
export interface IMedicineItem {
  medicineName: string;
  dosage?: string;
}

export interface ICustomer extends Document {
  name: string;
  phone: string;
  altPhone?: string;
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

const MedicineItemSchema = new Schema<IMedicineItem>({
  medicineName: { type: String, required: true, trim: true },
  dosage:       { type: String, trim: true },
}, { _id: false });

const CustomerSchema = new Schema<ICustomer>({
  name:        { type: String, required: true, trim: true, index: 'text' },
  phone:       { type: String, required: true, trim: true, index: true },
  altPhone:    { type: String, trim: true },
  notes:       { type: String, trim: true },
  medicines:   { type: [MedicineItemSchema], default: [] },
  nextDueDate: { type: Date, required: true, index: true },
  isActive:    { type: Boolean, default: true, index: true },
  reminderIgnored:           { type: Boolean, default: false, index: true },
  autoReminderSentForCycle:  { type: Boolean, default: false, index: true },
  autoReminderSentAt:        { type: Date, default: null },
  createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Compound index for the auto-send query
CustomerSchema.index({ isActive: 1, reminderIgnored: 1, autoReminderSentForCycle: 1, nextDueDate: 1 });
// Text index for search
CustomerSchema.index({ name: 'text', phone: 'text' });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
```

**Critical invariants** (enforce in service layer):
- When `nextDueDate` changes via any update path → set `autoReminderSentForCycle: false`, `autoReminderSentAt: null`, `reminderIgnored: false`.
- Soft-delete only: setting `isActive: false` instead of removing the document.

---

## 3. Payment

```ts
export interface IPayment extends Document {
  customerId: Types.ObjectId;
  type: 'received' | 'given';
  amount: number;             // in paise (1 INR = 100 paise) — store as integer
  date: Date;
  notes?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type:       { type: String, enum: ['received', 'given'], required: true, index: true },
  amount:     { type: Number, required: true, min: 0 },
  date:       { type: Date, required: true, index: true },
  notes:      { type: String, trim: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

PaymentSchema.index({ date: -1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
```

**Notes:**
- Amounts stored as integer paise to avoid float drift. Convert at API boundary.
- Payments are append-only by employees; only admins can delete.

---

## 4. Medicine

```ts
export interface IMedicine extends Document {
  name: string;
  category?: string;
  inStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema<IMedicine>({
  name:     { type: String, required: true, unique: true, trim: true },
  category: { type: String, trim: true },
  inStock:  { type: Boolean, default: true },
}, { timestamps: true });

MedicineSchema.index({ name: 'text' });

export const Medicine = model<IMedicine>('Medicine', MedicineSchema);
```

---

## 5. ActivityLog

```ts
export interface IActivityLog extends Document {
  actorId: Types.ObjectId | null;
  actorName: string;
  action: string;
  targetType?: 'customer' | 'employee' | 'payment' | 'medicine';
  targetId?: Types.ObjectId;
  targetName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  actorId:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
  actorName:  { type: String, required: true },
  action:     { type: String, required: true, index: true },
  targetType: { type: String, enum: ['customer', 'employee', 'payment', 'medicine'] },
  targetId:   { type: Schema.Types.ObjectId },
  targetName: { type: String },
  metadata:   { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ actorId: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', ActivityLogSchema);
```

**Action codes** (use consistent strings):
- `auth.signup`, `auth.approved`, `auth.rejected`, `auth.removed`
- `customer.create`, `customer.update`, `customer.delete`, `customer.due_date_update`, `customer.ignore`, `customer.unignore`
- `reminder.auto_sent`, `reminder.manual_sent`, `reminder.complete`
- `payment.create`, `payment.delete`
- `medicine.create`, `medicine.update`, `medicine.delete`
- `settings.update`

---

## 6. Settings

```ts
export interface ISettings extends Document {
  _id: 'settings';
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  defaultRefillCycleDays: number;
  reminderAutoSendTime: string;       // 'HH:MM'
  whatsappTemplateReminder: string;
  whatsappTemplateThankYou: string;
  whatsappCredentials: {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    apiVersion: string;
  };
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  _id:                       { type: String, default: 'settings' },
  pharmacyName:              { type: String, required: true, default: 'PharmaCare Pharmacy' },
  pharmacyAddress:           { type: String, default: '' },
  pharmacyPhone:             { type: String, default: '' },
  defaultRefillCycleDays:    { type: Number, default: 30 },
  reminderAutoSendTime:      { type: String, default: '10:00' },
  whatsappTemplateReminder:  { type: String, default: 'Hello {{name}}, this is a reminder from {{pharmacyName}} — your medicine refill ({{medicines}}) is due on {{dueDate}}. Please visit us to collect your prescription. Thank you.' },
  whatsappTemplateThankYou:  { type: String, default: 'Thank you for visiting {{pharmacyName}}, {{name}}. Your next refill ({{medicines}}) is scheduled for {{nextDueDate}}. See you then!' },
  whatsappCredentials: {
    accessToken:        { type: String, default: '' },
    phoneNumberId:      { type: String, default: '' },
    businessAccountId:  { type: String, default: '' },
    apiVersion:         { type: String, default: 'v21.0' },
  },
}, { timestamps: { updatedAt: true, createdAt: false } });

export const Settings = model<ISettings>('Settings', SettingsSchema);
```

**Notes:**
- Singleton — exactly one document with `_id: 'settings'`. Bootstrap on app start: `await Settings.findByIdAndUpdate('settings', {}, { upsert: true, setDefaultsOnInsert: true });`
- WhatsApp credentials should be **redacted** in API responses for non-admins (and even admins should see a masked view, with a "reveal" action).

---

## Seed Script

Create `apps/api/src/scripts/seed.ts` that:
1. Drops existing data (dev only — guard with `NODE_ENV !== 'production'`)
2. Creates Settings singleton
3. Creates 1 admin user (email/password from env, `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
4. Creates ~15 sample customers spread across due-date ranges (some overdue, some due today, some due in 3-7 days, some far future)
5. Creates ~25 medicines (use list from `design-source/data.jsx`)
6. Creates ~20 sample payments

The mock data in `design-source/data.jsx` is a great starting point — it's the same shape as the seed should produce.

Run with: `docker compose exec api npm run seed`

---

## Indexing checklist

| Collection | Index | Purpose |
|---|---|---|
| User | `email` (unique) | Login |
| User | `status` | Pending approvals query |
| Customer | `name` (text) + `phone` (text) | Search |
| Customer | `isActive`, `reminderIgnored`, `autoReminderSentForCycle`, `nextDueDate` (compound) | Auto-send cron |
| Customer | `nextDueDate` | Reminders list |
| Payment | `customerId`, `date` (-1) | Customer payment history |
| Payment | `date` (-1) | Recent payments list |
| Medicine | `name` (text + unique) | Autocomplete + dedupe |
| ActivityLog | `createdAt` (-1) | Recent activity |
| ActivityLog | `actorId, createdAt` (compound) | Filter by actor |
