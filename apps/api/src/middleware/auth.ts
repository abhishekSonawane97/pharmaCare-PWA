import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/User';
import { verifyAccessToken } from '../utils/jwt';
import { forbidden, unauthorized } from '../utils/errors';
import { attachTenantFromJwt } from './tenant';
import { modelsFor } from '../db/models';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(unauthorized('Missing access token'));
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(unauthorized('Invalid or expired token'));
    }

    // Attach tenant FROM THE JWT (server-trusted), not from any client field.
    // This is the security-critical step that makes multi-tenancy safe.
    if (!payload.tenant) {
      return next(unauthorized('Token missing tenant claim'));
    }
    try {
      attachTenantFromJwt(req, payload.tenant);
    } catch (err) {
      return next(unauthorized('Token carries unknown tenant'));
    }

    const { User } = modelsFor(req);
    const user = await User.findById(payload.sub);
    if (!user) return next(unauthorized('User not found'));
    if (user.status !== 'active') return next(forbidden('Account is not active'));
    req.user = user;
    // Touch lastActive (best-effort, don't await for latency)
    User.updateOne({ _id: user._id }, { lastActive: new Date() }).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  next();
}
