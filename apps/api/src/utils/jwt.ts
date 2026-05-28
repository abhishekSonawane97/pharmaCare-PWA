import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
const ACCESS_TTL = (process.env.JWT_ACCESS_TTL as any) || '15m';
const REFRESH_TTL = (process.env.JWT_REFRESH_TTL as any) || '7d';

export interface AccessPayload {
  sub: string;
  role: 'admin' | 'employee';
  status: 'pending' | 'active' | 'rejected';
}

export interface RefreshPayload {
  sub: string;
  ver: number;
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });

export const signRefreshToken = (payload: RefreshPayload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });

export const verifyAccessToken = (token: string) => jwt.verify(token, ACCESS_SECRET) as AccessPayload;
export const verifyRefreshToken = (token: string) => jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
