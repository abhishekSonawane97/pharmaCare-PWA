import { Router } from 'express';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get(
  '/',
  ah(async (req, res) => {
    const { ActivityLog } = modelsFor(req);
    const actorId = (req.query.actorId as string | undefined) || '';
    const action = (req.query.action as string | undefined) || '';
    const from = (req.query.from as string | undefined) || '';
    const to = (req.query.to as string | undefined) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));

    const conditions: any = {};
    if (actorId) conditions.actorId = actorId;
    if (action) conditions.action = action;
    if (from || to) {
      conditions.createdAt = {};
      if (from) conditions.createdAt.$gte = new Date(from);
      if (to) conditions.createdAt.$lte = new Date(to);
    }

    const total = await ActivityLog.countDocuments(conditions);
    const activities = await ActivityLog.find(conditions)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ data: { activities, total, page, limit } });
  })
);

export default router;
