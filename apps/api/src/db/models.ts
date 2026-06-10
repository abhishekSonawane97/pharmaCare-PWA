/**
 * Per-connection Mongoose model registration.
 *
 * Before multi-tenancy, each models/X.ts file did:
 *     export const X = model<IX>('X', XSchema);
 * That created ONE global model bound to the default mongoose connection.
 *
 * With multi-tenancy, models must be registered per-connection. Each model file
 * now exports only the schema; this file registers those schemas on whatever
 * connection it's given, caches the result, and returns a typed bag of models.
 *
 * Route handlers use `modelsFor(req)` to get the bag scoped to the caller's tenant.
 */

import { Connection, Model } from 'mongoose';
import type { Request } from 'express';

import { UserSchema, IUser } from '../models/User';
import { CustomerSchema, ICustomer } from '../models/Customer';
import { MedicineSchema, IMedicine } from '../models/Medicine';
import { PaymentSchema, IPayment } from '../models/Payment';
import { ActivityLogSchema, IActivityLog } from '../models/ActivityLog';
import { SettingsSchema, ISettings } from '../models/Settings';
import { PushSubscriptionSchema, IPushSubscription } from '../models/PushSubscription';

export interface TenantModels {
  User: Model<IUser>;
  Customer: Model<ICustomer>;
  Medicine: Model<IMedicine>;
  Payment: Model<IPayment>;
  ActivityLog: Model<IActivityLog>;
  Settings: Model<ISettings>;
  PushSubscription: Model<IPushSubscription>;
}

// Cached per-connection so repeated lookups don't try to re-register
const cache = new WeakMap<Connection, TenantModels>();

/**
 * Register (or return cached) all models on the given connection.
 *
 * Mongoose's `conn.model(name, schema)` is idempotent in the sense that if a
 * model with that name is already registered on the connection it returns the
 * existing one, but only if called with the SAME schema reference. We cache to
 * avoid the lookup overhead entirely.
 */
export function getModels(conn: Connection): TenantModels {
  const cached = cache.get(conn);
  if (cached) return cached;

  const models: TenantModels = {
    User: conn.model<IUser>('User', UserSchema),
    Customer: conn.model<ICustomer>('Customer', CustomerSchema),
    Medicine: conn.model<IMedicine>('Medicine', MedicineSchema),
    Payment: conn.model<IPayment>('Payment', PaymentSchema),
    ActivityLog: conn.model<IActivityLog>('ActivityLog', ActivityLogSchema),
    Settings: conn.model<ISettings>('Settings', SettingsSchema),
    PushSubscription: conn.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema),
  };
  cache.set(conn, models);
  return models;
}

/**
 * Convenience for route handlers: return the model bag scoped to the request's
 * tenant. Assumes earlier middleware (requireAuth or tenantFromBody) has
 * attached `req.tenantConnection`.
 */
export function modelsFor(req: Request): TenantModels {
  if (!req.tenantConnection) {
    throw new Error('modelsFor() called before tenant middleware set req.tenantConnection');
  }
  return getModels(req.tenantConnection);
}
