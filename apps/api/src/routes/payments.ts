import { Router } from 'express';
import { z } from 'zod';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { notFound, validationError } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { startOfMonth } from '../utils/dateWindow';

const router = Router();
router.use(requireAuth);

const paymentCreateSchema = z.object({
  customerId: z.string().nullable().optional(),
  type: z.enum(['received', 'given']),
  amount: z.number().nonnegative(),
  date: z.string().min(1),
  notes: z.string().optional().or(z.literal('')),
  walkIn: z.boolean().optional(),
  walkInName: z.string().optional(),
  walkInPhone: z.string().optional(),
  due: z.boolean().optional(),
});

router.get(
  '/',
  ah(async (req, res) => {
    const { Payment } = modelsFor(req);
    const q = (req.query.q as string | undefined)?.trim() || '';
    const type = (req.query.type as string | undefined) || 'all';
    const customerId = (req.query.customerId as string | undefined) || '';
    const from = (req.query.from as string | undefined) || '';
    const to = (req.query.to as string | undefined) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) || '100', 10)));

    const conditions: any = {};
    if (type === 'received' || type === 'given') conditions.type = type;
    if (customerId) conditions.customerId = customerId;
    if (from || to) {
      conditions.date = {};
      if (from) conditions.date.$gte = new Date(from);
      if (to) conditions.date.$lte = new Date(to);
    }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      conditions.$or = [{ notes: re }, { walkInName: re }, { walkInPhone: re }];
    }

    const total = await Payment.countDocuments(conditions);
    const payments = await Payment.find(conditions)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'name phone')
      .lean();

    const monthStart = startOfMonth();
    const monthAgg = await Payment.aggregate([
      { $match: { date: { $gte: monthStart } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const summary = { received: 0, given: 0 };
    for (const r of monthAgg) {
      if (r._id === 'received') summary.received = r.total;
      if (r._id === 'given') summary.given = r.total;
    }

    res.json({ data: { payments, total, summary } });
  })
);

router.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const { Payment, Customer, ActivityLog } = modelsFor(req);
    const body = paymentCreateSchema.parse(req.body);
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) throw validationError('Invalid date');

    let customerName: string | undefined;
    if (body.customerId) {
      const c = await Customer.findById(body.customerId);
      if (!c) throw notFound('Customer not found');
      customerName = c.name;
    }

    const payment = await Payment.create({
      customerId: body.customerId || null,
      type: body.type,
      amount: body.amount,
      date,
      notes: body.notes || undefined,
      walkIn: body.walkIn || false,
      walkInName: body.walkIn ? body.walkInName : undefined,
      walkInPhone: body.walkIn ? body.walkInPhone : undefined,
      due: body.walkIn ? !!body.due : false,
      recordedBy: req.user!._id,
    });

    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'payment.create',
      targetType: 'payment',
      targetId: payment._id,
      targetName: customerName || body.walkInName || `${body.type} payment`,
      metadata: { amount: body.amount, type: body.type, walkIn: body.walkIn || false },
    });

    res.status(201).json({ data: { payment } });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Payment } = modelsFor(req);
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw notFound('Payment not found');
    if (typeof req.body.due === 'boolean') payment.due = req.body.due;
    await payment.save();
    res.json({ data: { payment } });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Payment, ActivityLog } = modelsFor(req);
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw notFound('Payment not found');
    await payment.deleteOne();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'payment.delete',
      targetType: 'payment',
      targetId: payment._id,
      metadata: { amount: payment.amount, type: payment.type },
    });
    res.status(204).send();
  })
);

export default router;
