import { Schema, model, Document } from 'mongoose';

export interface ISettings extends Omit<Document, '_id'> {
  _id: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  defaultRefillCycleDays: number;
  messageTemplateReminder: string;
  messageTemplateThankYou: string;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    _id: { type: String, default: 'settings' },
    pharmacyName: { type: String, required: true, default: 'PharmaCare Pharmacy' },
    pharmacyAddress: { type: String, default: '' },
    pharmacyPhone: { type: String, default: '' },
    defaultRefillCycleDays: { type: Number, default: 30 },
    messageTemplateReminder: {
      type: String,
      default:
        'Hi {{name}}, refill reminder from {{pharmacyName}}: {{medicines}} due {{dueDate}}. Visit us to collect. Thanks.',
    },
    messageTemplateThankYou: {
      type: String,
      default:
        'Thanks for visiting {{pharmacyName}}, {{name}}. Next refill ({{medicines}}) on {{nextDueDate}}. See you then.',
    },
  },
  { timestamps: { updatedAt: true, createdAt: false } }
);

export const Settings = model<ISettings>('Settings', SettingsSchema);

export async function ensureSettings(): Promise<ISettings> {
  const existing = await Settings.findById('settings');
  if (existing) return existing;
  return Settings.create({ _id: 'settings' });
}
