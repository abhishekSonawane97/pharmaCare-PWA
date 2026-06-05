import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ah } from '../utils/asyncHandler';
import { HttpError, conflict, unauthorized } from '../utils/errors';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { requireAuth } from '../middleware/auth';
import { tenantFromBody } from '../middleware/tenant';
import { normalizePhone } from '../utils/phone';
import { modelsFor } from '../db/models';
import { isTenantId } from '../config/tenants';
import { getTenantConnection } from '../db/connections';
import { getModels } from '../db/models';

const router = Router();

const tenantField = z.string().min(1);

const signupSchema = z.object({
  tenant: tenantField,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  password: z.string().min(6),
});

const loginSchema = z.object({
  tenant: tenantField,
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post(
  '/signup',
  tenantFromBody,
  ah(async (req, res) => {
    const body = signupSchema.parse(req.body);
    const tenant = req.tenant!; // tenantFromBody guarantees this
    const { User, ActivityLog } = modelsFor(req);

    const email = body.email.toLowerCase().trim();
    const dupe = await User.findOne({ email });
    if (dupe) throw conflict('Email already registered');

    const userCount = await User.countDocuments();
    const isFirst = userCount === 0;
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name.trim(),
      email,
      phone: normalizePhone(body.phone),
      passwordHash,
      role: isFirst ? 'admin' : 'employee',
      status: isFirst ? 'active' : 'pending',
    });

    await ActivityLog.create({
      actorId: user._id,
      actorName: user.name,
      action: 'auth.signup',
      targetType: 'employee',
      targetId: user._id,
      targetName: user.name,
      metadata: { firstUser: isFirst, tenant },
    });

    if (user.status === 'active') {
      const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role, status: user.status, tenant });
      const refreshToken = signRefreshToken({ sub: user._id.toString(), ver: user.refreshTokenVersion, tenant });
      res.status(201).json({
        data: { user: user.toJSON(), accessToken, refreshToken },
      });
    } else {
      res.status(201).json({ data: { user: user.toJSON() } });
    }
  })
);

router.post(
  '/login',
  tenantFromBody,
  ah(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const tenant = req.tenant!;
    const { User } = modelsFor(req);

    const email = body.email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) throw unauthorized('Invalid credentials');

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');

    if (user.status === 'pending')
      throw new HttpError(403, 'pending', 'Your account is pending admin approval');
    if (user.status === 'rejected')
      throw new HttpError(403, 'rejected', 'Your account access has been revoked');

    user.lastActive = new Date();
    await user.save();

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role, status: user.status, tenant });
    const refreshToken = signRefreshToken({ sub: user._id.toString(), ver: user.refreshTokenVersion, tenant });

    res.json({ data: { user: user.toJSON(), accessToken, refreshToken } });
  })
);

router.post(
  '/refresh',
  ah(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    let payload;
    try {
      payload = verifyRefreshToken(body.refreshToken);
    } catch {
      throw unauthorized('Invalid refresh token');
    }
    if (!payload.tenant || !isTenantId(payload.tenant)) {
      throw unauthorized('Refresh token missing or has unknown tenant');
    }

    // Use the tenant FROM THE TOKEN, not from any client field.
    const conn = getTenantConnection(payload.tenant);
    const { User } = getModels(conn);
    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized('User not found');
    if (user.refreshTokenVersion !== payload.ver) throw unauthorized('Token revoked');
    if (user.status !== 'active') throw unauthorized('Account inactive');

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role, status: user.status, tenant: payload.tenant });
    const refreshToken = signRefreshToken({ sub: user._id.toString(), ver: user.refreshTokenVersion, tenant: payload.tenant });
    res.json({ data: { accessToken, refreshToken } });
  })
);

router.post(
  '/logout',
  requireAuth,
  ah(async (req, res) => {
    const user = req.user!;
    user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
    await user.save();
    res.status(204).send();
  })
);

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    res.json({ data: { user: req.user!.toJSON() } });
  })
);

export default router;
