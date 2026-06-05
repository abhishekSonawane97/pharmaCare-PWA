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
 */
export function tenantFromBody(req: Request, _res: Response, next: NextFunction) {
  const t = req.body?.tenant;
  if (!isTenantId(t)) {
    return next(validationError('Missing or invalid tenant'));
  }
  req.tenant = t;
  req.tenantConnection = getTenantConnection(t);
  next();
}

/**
 * Helper used by requireAuth to attach tenant info from a decoded JWT.
 */
export function attachTenantFromJwt(req: Request, tenantId: string): void {
  if (!isTenantId(tenantId)) {
    throw new Error(`JWT carries unknown tenant: ${tenantId}`);
  }
  req.tenant = tenantId;
  req.tenantConnection = getTenantConnection(tenantId);
}
