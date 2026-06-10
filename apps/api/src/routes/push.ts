/**
 * Push notification endpoints.
 *
 *   GET    /api/push/public-key   — returns the VAPID public key for the
 *                                    frontend's PushManager.subscribe() call.
 *                                    Public-safe (this is the public half of
 *                                    the keypair). Doesn't require auth so the
 *                                    frontend can fetch it cleanly.
 *   POST   /api/push/subscribe    — upsert a subscription for the current user
 *   DELETE /api/push/unsubscribe  — remove the current user's subscription
 *                                    matching the given endpoint
 *   POST   /api/push/test         — admin-only smoke test; sends a notification
 *                                    to the calling user's subscribed devices
 */

import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../utils/asyncHandler';
import { notFound, validationError } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { modelsFor } from '../db/models';
import { sendToUser, isPushConfigured } from '../services/pushNotifications';

const router = Router();

router.get(
  '/public-key',
  ah(async (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) {
      return res.json({ data: { publicKey: null, configured: false } });
    }
    res.json({ data: { publicKey: key, configured: true } });
  })
);

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.post(
  '/subscribe',
  requireAuth,
  ah(async (req, res) => {
    const body = subscribeSchema.parse(req.body);
    const { PushSubscription } = modelsFor(req);

    // Upsert by endpoint: same browser re-subscribing should refresh keys,
    // not create a second row. Reattach to current user even if a different
    // user subscribed this device before (the new login owns it now).
    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint: body.endpoint },
      {
        $set: {
          userId: req.user!._id,
          endpoint: body.endpoint,
          keys: body.keys,
          userAgent: req.get('user-agent') || undefined,
          lastSeenAt: new Date(),
          failureCount: 0,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ data: { subscription: { _id: sub._id, endpoint: sub.endpoint } } });
  })
);

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

router.delete(
  '/unsubscribe',
  requireAuth,
  ah(async (req, res) => {
    const body = unsubscribeSchema.parse(req.body);
    const { PushSubscription } = modelsFor(req);

    // Only remove if the subscription belongs to the calling user — prevents
    // a malicious or buggy client from nuking someone else's subscription
    // by guessing the endpoint URL.
    const result = await PushSubscription.deleteOne({
      endpoint: body.endpoint,
      userId: req.user!._id,
    });

    if (result.deletedCount === 0) throw notFound('Subscription not found');
    res.status(204).send();
  })
);

router.post(
  '/test',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    if (!isPushConfigured()) {
      throw validationError('Push notifications are not configured on this server (missing VAPID env vars)');
    }
    const models = modelsFor(req);
    const result = await sendToUser(models, req.user!._id.toString(), {
      title: 'PharmaCare test notification',
      body: 'If you see this, push delivery is working from the server.',
      url: '/',
      tag: 'pharmacare-test',
    });
    res.json({ data: result });
  })
);

export default router;
