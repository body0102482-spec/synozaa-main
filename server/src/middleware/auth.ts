import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const REFRESH_GRACE_SECONDS = 90 * 24 * 60 * 60;
const JWT_FALLBACK_SECRET = 'synoza-jwt-default-secret-key-super-secure-2026';

export function verifyAccessToken(token: string): AuthUser | null {
  const secret = process.env.JWT_SECRET || JWT_FALLBACK_SECRET;
  try {
    return jwt.verify(token, secret) as AuthUser;
  } catch {
    return null;
  }
}

/** Accepts valid tokens and recently expired tokens (for silent refresh). */
export function verifyTokenForRefresh(token: string): AuthUser | null {
  const secret = process.env.JWT_SECRET || JWT_FALLBACK_SECRET;

  try {
    return jwt.verify(token, secret) as AuthUser;
  } catch (err) {
    if (!(err instanceof jwt.TokenExpiredError)) return null;
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.exp) return null;
    if (Date.now() / 1000 - decoded.exp > REFRESH_GRACE_SECONDS) return null;
    try {
      return jwt.verify(token, secret, { ignoreExpiration: true }) as AuthUser;
    } catch {
      return null;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyAccessToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  void import('../services/lastSeenService.js').then(({ touchLastSeen }) => {
    touchLastSeen(payload.id);
  });
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
