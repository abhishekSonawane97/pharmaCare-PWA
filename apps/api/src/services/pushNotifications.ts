/**
 * Web Push wrapper.
 *
 * Single VAPID identity is shared across all tenants — VAPID identifies the
 * sender (us, the api), not the recipient. Per-subscription targeting is
 * handled by the {endpoint, keys} payload we POST to the push service.
 *
 * We initialize web-push lazily on the first send so the api can boot in
 * environments where VAPID env vars haven't been set yet (e.g. fresh
 * deploys before the user pastes the keys into Dokploy).
 */

import webpush from 'web-push';
import type { IPushSubscription } from '../models/PushSubscription';
import type { TenantModels } from '../db/models';

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@pharmacare.local';
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;            // path to open on click, e.g. '/reminders'
  tag?: string;            // dedup key — replaces previous notification with same tag
  icon?: string;
  badge?: string;
}

export interface SendResult {
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Send the same payload to every active subscription for a given user.
 * Each user may have multiple subscriptions (phone + tablet + desktop).
 *
 * Failed-and-410 subscriptions (browser unsubscribed, key rotated, etc.) are
 * deleted from the DB so we don't keep trying. Other failures bump
 * failureCount; subscriptions hit by repeated failures are evicted.
 */
export async function sendToUser(
  models: TenantModels,
  userId: string,
  payload: PushPayload
): Promise<SendResult> {
  if (!configureVapid()) {
    console.warn('[push] VAPID not configured — skipping send');
    return { sent: 0, removed: 0, failed: 0 };
  }

  const subs = await models.PushSubscription.find({ userId }).lean();
  if (!subs.length) return { sent: 0, removed: 0, failed: 0 };

  const json = JSON.stringify(payload);
  let sent = 0, removed = 0, failed = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: s.keys,
        },
        json,
        { TTL: 24 * 60 * 60 } // 24h: notification is meaningful for one day
      );
      sent++;
      // Best-effort: bump lastSeenAt + reset failure count on success
      await models.PushSubscription.updateOne(
        { _id: s._id },
        { lastSeenAt: new Date(), failureCount: 0 }
      ).catch(() => { /* ignore */ });
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription is permanently gone (user uninstalled / cleared data).
        // Remove from DB so we don't retry forever.
        await models.PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
        removed++;
      } else {
        // Transient failure (network, rate limit). Bump counter; evict after
        // a few consecutive failures so we don't accumulate dead subscriptions.
        const updated = await models.PushSubscription.findOneAndUpdate(
          { _id: s._id },
          { $inc: { failureCount: 1 } },
          { new: true }
        ).catch(() => null);
        if (updated && updated.failureCount >= 5) {
          await models.PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
          removed++;
        } else {
          failed++;
        }
        console.warn(`[push] send failed (sub ${s._id}, status ${status}):`, err?.body || err?.message);
      }
    }
  }));

  return { sent, removed, failed };
}

/**
 * Send a payload to every admin user in the tenant. Returns aggregated counts.
 * Used by the daily-reminders cron.
 */
export async function sendToAdmins(
  models: TenantModels,
  payload: PushPayload
): Promise<SendResult & { recipients: number }> {
  const admins = await models.User.find(
    { role: 'admin', status: 'active' },
    { _id: 1 }
  ).lean();

  const totals: SendResult = { sent: 0, removed: 0, failed: 0 };
  for (const a of admins) {
    const r = await sendToUser(models, a._id.toString(), payload);
    totals.sent += r.sent;
    totals.removed += r.removed;
    totals.failed += r.failed;
  }
  return { ...totals, recipients: admins.length };
}

/**
 * Lightweight check used by the route layer + cron to decide whether
 * to attempt a send at all. Avoids surprising "silent no-op" behavior.
 */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
