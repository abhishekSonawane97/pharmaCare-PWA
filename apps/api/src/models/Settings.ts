import { Schema, Document, Model } from 'mongoose';

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

export const SettingsSchema = new Schema<ISettings>(
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

/**
 * Ensure the singleton Settings doc exists for the given tenant's Settings model.
 * Pass the per-tenant model from getModels(conn).
 */
export async function ensureSettings(SettingsModel: Model<ISettings>): Promise<ISettings> {
  const existing = await SettingsModel.findById('settings');
  if (existing) return existing;
  return SettingsModel.create({ _id: 'settings' });
}
