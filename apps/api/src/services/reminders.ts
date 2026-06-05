import { ICustomer } from '../models/Customer';
import { ensureSettings } from '../models/Settings';
import { reminderWindow } from '../utils/dateWindow';
import { buildReminderLinks, buildThankYouLinks, ReminderLinks } from './messageLinks';
import type { TenantModels } from '../db/models';

export interface ReminderRow {
  customer: ICustomer;
  links: ReminderLinks;
}

export async function listReminderQueue(models: TenantModels): Promise<ReminderRow[]> {
  const { from, to } = reminderWindow();
  const settings = await ensureSettings(models.Settings);

  const customers = await models.Customer.find({
    isActive: true,
    reminderIgnored: false,
    nextDueDate: { $gte: from, $lte: to },
  }).sort({ nextDueDate: 1 });

  return customers.map(c => ({ customer: c, links: buildReminderLinks(c, settings) }));
}

export type SendChannel = 'whatsapp' | 'sms';

export async function markReminderSent(
  models: TenantModels,
  customer: ICustomer,
  channel: SendChannel,
  actorId: string | null,
  actorName: string
): Promise<Date> {
  const stamp = new Date();
  customer.autoReminderSentForCycle = true;
  customer.autoReminderSentAt = stamp;
  await customer.save();

  await models.ActivityLog.create({
    actorId,
    actorName,
    action: 'reminder.manual_sent',
    targetType: 'customer',
    targetId: customer._id,
    targetName: customer.name,
    metadata: { channel, sentAt: stamp.toISOString() },
  });

  return stamp;
}

export async function buildThankYouForCustomer(
  models: TenantModels,
  customer: ICustomer,
  nextDueDate: Date
): Promise<ReminderLinks> {
  const settings = await ensureSettings(models.Settings);
  return buildThankYouLinks(customer, settings, nextDueDate);
}
