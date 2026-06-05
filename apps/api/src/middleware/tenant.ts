/**
 * Tenant resolution middleware.
 *
 * Two flavors:
 *  - tenantFromBody: used on the login + signup routes. Reads tenant from
 *    req.body.tenant, validates it, attaches req.tenant + req.tenantConnection.
 *  - The authed flavor lives inside middleware/auth.ts requireAuth, which reads
 *    tenant from the verified JWT payload (so it's server-trusted).
 *
 * Critical security property: on any authed request, the tenant MUST come from
 * the JWT and not from any client-controlled field. The body is ignored.
 */

import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import { isTenantId, TenantId } from '../config/tenants';
import { getTenantConnection } from '../db/connections';
import { validationError } from '../utils/errors';

// Extend Express Request to carry tenant info downstream
declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantId;
    tenantConnection?: Connection;
  }
}

/**
 * Mounted before /auth/login and /auth/signup. The body must contain
 * { tenant: 'pharmacare' | 'adilpharmacy' | ... }.
 *
 * If the tenant is registered but its Mongo URI env var is missing
 * (e.g. on a Render deploy that hasn't been onboarded yet), this returns
 * a clean 400 instead of crashing.
 */
export function tenantFromBody(req: Request, _res: Response, next: NextFunction) {
  const t = req.body?.tenant;
  if (!isTenantId(t)) {
    return next(validationError('Missing or invalid tenant'));
  }
  try {
    req.tenant = t;
    req.tenantConnection = getTenantConnection(t);
    next();
  } catch (err: any) {
    return next(validationError(`Tenant "${t}" is not available on this deployment: ${err?.message || err}`));
  }
}

/**
 * Helper used by requireAuth to attach tenant info from a decoded JWT.
 * Returns true on success, false if the tenant cannot be resolved (caller
 * should respond with unauthorized in that case).
 */
export function attachTenantFromJwt(req: Request, tenantId: string): boolean {
  if (!isTenantId(tenantId)) {
    return false;
  }
  try {
    req.tenant = tenantId;
    req.tenantConnection = getTenantConnection(tenantId);
    return true;
  } catch (err: any) {
    console.error(`[tenant] cannot resolve JWT tenant ${tenantId}:`, err?.message || err);
    return false;
  }
}
