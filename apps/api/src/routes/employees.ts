import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { conflict, notFound } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { normalizePhone } from '../utils/phone';

const router = Router();
router.use(requireAuth, requireAdmin);

const employeeCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['admin', 'employee']).default('employee'),
});

router.get(
  '/',
  ah(async (req, res) => {
    const { User } = modelsFor(req);
    const all = await User.find({ status: { $ne: 'rejected' } }).sort({ createdAt: -1 }).lean();
    const active = all.filter(u => u.status === 'active');
    const pending = all.filter(u => u.status === 'pending');
    res.json({ data: { active, pending } });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { User, ActivityLog } = modelsFor(req);
    const body = employeeCreateSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const dupe = await User.findOne({ email });
    if (dupe) throw conflict('Email already registered');
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name.trim(),
      email,
      phone: normalizePhone(body.phone),
      passwordHash,
      role: body.role,
      status: 'active',
    });
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'auth.approved',
      targetType: 'employee',
      targetId: user._id,
      targetName: user.name,
      metadata: { directAdd: true, role: body.role },
    });
    res.status(201).json({ data: { user: user.toJSON() } });
  })
);

router.post(
  '/:id/approve',
  ah(async (req, res) => {
    const { User, ActivityLog } = modelsFor(req);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found');
    user.status = 'active';
    await user.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'auth.approved',
      targetType: 'employee',
      targetId: user._id,
      targetName: user.name,
    });
    res.json({ data: { user: user.toJSON() } });
  })
);

router.post(
  '/:id/reject',
  ah(async (req, res) => {
    const { User, ActivityLog } = modelsFor(req);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found');
    user.status = 'rejected';
    user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
    await user.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'auth.rejected',
      targetType: 'employee',
      targetId: user._id,
      targetName: user.name,
    });
    res.json({ data: { user: user.toJSON() } });
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const { User, ActivityLog } = modelsFor(req);
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('User not found');
    user.status = 'rejected';
    user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
    await user.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'auth.removed',
      targetType: 'employee',
      targetId: user._id,
      targetName: user.name,
    });
    res.status(204).send();
  })
);

export default router;
