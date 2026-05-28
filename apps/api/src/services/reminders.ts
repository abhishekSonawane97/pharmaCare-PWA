import { Customer, ICustomer } from '../models/Customer';
import { ActivityLog } from '../models/ActivityLog';
import { ensureSettings } from '../models/Settings';
import { reminderWindow } from '../utils/dateWindow';
import { buildReminderLinks, buildThankYouLinks, ReminderLinks } from './messageLinks';

export interface ReminderRow {
  customer: ICustomer;
  links: ReminderLinks;
}

export async function listReminderQueue(): Promise<ReminderRow[]> {
  const { from, to } = reminderWindow();
  const settings = await ensureSettings();

  const customers = await Customer.find({
    isActive: true,
    reminderIgnored: false,
    nextDueDate: { $gte: from, $lte: to },
  }).sort({ nextDueDate: 1 });

  return customers.map(c => ({ customer: c, links: buildReminderLinks(c, settings) }));
}

export type SendChannel = 'whatsapp' | 'sms';

export async function markReminderSent(
  customer: ICustomer,
  channel: SendChannel,
  actorId: string | null,
  actorName: string
): Promise<Date> {
  const stamp = new Date();
  customer.autoReminderSentForCycle = true;
  customer.autoReminderSentAt = stamp;
  await customer.save();

  await ActivityLog.create({
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
  customer: ICustomer,
  nextDueDate: Date
): Promise<ReminderLinks> {
  const settings = await ensureSettings();
  return buildThankYouLinks(customer, settings, nextDueDate);
}
