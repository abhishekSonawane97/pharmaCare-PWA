import { Router } from 'express';
import { z } from 'zod';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { notFound, validationError } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listReminderQueue,
  markReminderSent,
  buildThankYouForCustomer,
} from '../services/reminders';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get(
  '/',
  ah(async (req, res) => {
    const models = modelsFor(req);
    const rows = await listReminderQueue(models);
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
    const models = modelsFor(req);
    const { Customer } = models;
    const { channel } = markSentSchema.parse(req.body);
    const customer = await Customer.findById(req.params.customerId);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    if (!customer.phone) throw validationError('Customer has no phone');
    const sentAt = await markReminderSent(models, customer, channel, req.user!._id.toString(), req.user!.name);
    res.json({ data: { sent: true, sentAt, customer } });
  })
);

const completeSchema = z.object({
  nextDueDate: z.string().min(1),
});

router.post(
  '/:customerId/complete',
  ah(async (req, res) => {
    const models = modelsFor(req);
    const { Customer, ActivityLog } = models;
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
      ? await buildThankYouForCustomer(models, customer, newDue)
      : null;

    res.json({ data: { customer, thankYouLinks } });
  })
);

export default router;
