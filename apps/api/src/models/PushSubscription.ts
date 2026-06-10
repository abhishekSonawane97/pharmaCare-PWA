import { Schema, Document, Types } from 'mongoose';

/**
 * One PushSubscription document per (user × device/browser) that has opted in
 * to push notifications. The browser's `endpoint` URL is the canonical unique
 * identifier — same user on a phone + tablet = two docs.
 *
 * The `keys` object holds the `p256dh` + `auth` values returned by
 * `PushManager.subscribe()` on the client; they're what `web-push` uses to
 * encrypt the notification payload.
 *
 * Per-tenant: this model is registered against each tenant's Mongo connection
 * via apps/api/src/db/models.ts, so subscriptions live in the same database
 * as the user they belong to. A PharmaCare admin's phone subscription is
 * NOT visible from the Adil tenant and vice versa.
 */

export interface IPushSubscription extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  lastSeenAt: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The endpoint is unique per browser/device; same URL = same subscription.
    // We use it as the dedup key when upserting.
    endpoint: { type: String, required: true, unique: true, index: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Stored for debugging — "which device was this?" Useful when a user
    // wants to see their subscribed devices in a future Settings page.
    userAgent: { type: String, trim: true },
    lastSeenAt: { type: Date, default: () => new Date() },
    // Incremented on each delivery failure. Subscriptions with high counts
    // are cleaned up by the cron (or on the next failed delivery).
    failureCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);
