import { Router } from 'express';
import { z } from 'zod';
import { ensureSettings } from '../models/Settings';
import { ActivityLog } from '../models/ActivityLog';
import { ah } from '../utils/asyncHandler';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireAdmin);

const settingsSchema = z.object({
  pharmacyName: z.string().min(1).optional(),
  pharmacyAddress: z.string().optional(),
  pharmacyPhone: z.string().optional(),
  defaultRefillCycleDays: z.number().int().positive().optional(),
  messageTemplateReminder: z.string().min(1).optional(),
  messageTemplateThankYou: z.string().min(1).optional(),
});

router.get(
  '/',
  ah(async (_req, res) => {
    const settings = await ensureSettings();
    res.json({ data: { settings } });
  })
);

router.put(
  '/',
  ah(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const settings = await ensureSettings();

    if (body.pharmacyName !== undefined) settings.pharmacyName = body.pharmacyName;
    if (body.pharmacyAddress !== undefined) settings.pharmacyAddress = body.pharmacyAddress;
    if (body.pharmacyPhone !== undefined) settings.pharmacyPhone = body.pharmacyPhone;
    if (body.defaultRefillCycleDays !== undefined) settings.defaultRefillCycleDays = body.defaultRefillCycleDays;
    if (body.messageTemplateReminder !== undefined) settings.messageTemplateReminder = body.messageTemplateReminder;
    if (body.messageTemplateThankYou !== undefined) settings.messageTemplateThankYou = body.messageTemplateThankYou;

    await settings.save();

    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'settings.update',
      metadata: { changedFields: Object.keys(body) },
    });

    res.json({ data: { settings } });
  })
);

export default router;
