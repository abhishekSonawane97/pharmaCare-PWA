/**
 * Daily cron — at the configured time, finds the day's reminder queue for
 * each tenant and pushes "X customers due today" to every admin in that
 * tenant who has an active push subscription.
 *
 * Reintroduces a server-side scheduled job. Note: this only NOTIFIES the
 * pharmacist. The actual customer-facing message still goes through the
 * pharmacist's own phone (wa.me / sms:) via the existing click-to-send flow.
 *
 * Single-instance assumption: we run one api container per environment.
 * If you ever scale to multiple api containers, only one should run the cron
 * (use a leader election or a separate scheduler service).
 */

import cron, { ScheduledTask } from 'node-cron';
import { TENANT_IDS, getTenantConfig } from '../config/tenants';
import { getTenantConnection } from '../db/connections';
import { getModels } from '../db/models';
import { reminderWindow } from '../utils/dateWindow';
import { sendToAdmins, isPushConfigured } from './pushNotifications';

let task: ScheduledTask | null = null;
let scheduledExpr: string | null = null;

function buildExpr(hhmm: string) {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  const safeH = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 10;
  const safeM = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0;
  return `${safeM} ${safeH} * * *`;
}

export async function runDailyReminderPush(): Promise<void> {
  if (!isPushConfigured()) {
    console.log('[push-cron] VAPID not configured — skipping');
    return;
  }
  const { from, to } = reminderWindow();
  for (const t of TENANT_IDS) {
    try {
      const conn = getTenantConnection(t);
      if (conn.readyState !== 1) {
        console.warn(`[push-cron] tenant ${t} not connected, skipping`);
        continue;
      }
      const models = getModels(conn);
      const cfg = getTenantConfig(t);

      const dueCount = await models.Customer.countDocuments({
        isActive: true,
        reminderIgnored: false,
        nextDueDate: { $gte: from, $lte: to },
      });

      if (dueCount === 0) {
        console.log(`[push-cron] ${t}: 0 reminders, skipping`);
        continue;
      }

      const noun = dueCount === 1 ? 'customer' : 'customers';
      const result = await sendToAdmins(models, {
        title: `${cfg.displayName} reminders`,
        body: `${dueCount} ${noun} due in the next 2 days — tap to open the queue.`,
        url: '/reminders',
        tag: `pharmacare-daily-${t}`, // replaces yesterday's notification for the same tenant
      });

      console.log(
        `[push-cron] ${t}: ${dueCount} due, ${result.recipients} admin(s), ` +
        `sent=${result.sent} removed=${result.removed} failed=${result.failed}`
      );
    } catch (err: any) {
      console.error(`[push-cron] tenant ${t} failed:`, err?.message || err);
    }
  }
}

/**
 * Start (or restart) the daily cron. Called once at api boot.
 *
 * `hhmm` is interpreted in the api's local timezone, which the docker-compose
 * sets to Asia/Kolkata. Override with PUSH_CRON_TIME env var if needed.
 */
export function startDailyReminderCron(hhmm = process.env.PUSH_CRON_TIME || '10:00') {
  const expr = buildExpr(hhmm);
  if (expr === scheduledExpr && task) return;
  if (task) task.stop();
  scheduledExpr = expr;
  task = cron.schedule(
    expr,
    async () => {
      console.log(`[push-cron] firing daily reminder push (${expr})`);
      try {
        await runDailyReminderPush();
      } catch (err) {
        console.error('[push-cron] dispatch failed:', err);
      }
    },
    { timezone: process.env.TZ || 'Asia/Kolkata' }
  );
  console.log(`[push-cron] scheduled "${expr}" (${process.env.TZ || 'Asia/Kolkata'})`);
}
