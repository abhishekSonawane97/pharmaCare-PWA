import { Router } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { ActivityLog } from '../models/ActivityLog';
import { ah } from '../utils/asyncHandler';
import { notFound, validationError } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listReminderQueue,
  markReminderSent,
  buildThankYouForCustomer,
} from '../services/reminders';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  ah(async (_req, res) => {
    const rows = await listReminderQueue();
    const reminders = rows.map(r => ({
      ...r.customer.toJSON(),
      links: r.links,
    }));
    res.json({ data: { reminders } });
  })
);

const markSentSchema = z.object({
  channel: z.enum(['whatsapp', 'sms']),
});

router.post(
  '/:customerId/mark-sent',
  ah(async (req, res) => {
    const { channel } = markSentSchema.parse(req.body);
    const customer = await Customer.findById(req.params.customerId);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    if (!customer.phone) throw validationError('Customer has no phone');
    const sentAt = await markReminderSent(customer, channel, req.user!._id.toString(), req.user!.name);
    res.json({ data: { sent: true, sentAt, customer } });
  })
);

const completeSchema = z.object({
  nextDueDate: z.string().min(1),
});

router.post(
  '/:customerId/complete',
  requireAdmin,
  ah(async (req, res) => {
    const body = completeSchema.parse(req.body);
    const customer = await Customer.findById(req.params.customerId);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    const newDue = new Date(body.nextDueDate);
    if (Number.isNaN(newDue.getTime())) throw validationError('Invalid nextDueDate');

    customer.nextDueDate = newDue;
    customer.autoReminderSentForCycle = false;
    customer.autoReminderSentAt = null;
    customer.reminderIgnored = false;
    await customer.save();

    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'reminder.complete',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
      metadata: { nextDueDate: newDue.toISOString() },
    });

    const thankYouLinks = customer.phone && customer.medicines.length
      ? await buildThankYouForCustomer(customer, newDue)
      : null;

    res.json({ data: { customer, thankYouLinks } });
  })
);

export default router;
