import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface DealerPayload {
  dealerId: string;
  mobile: string;
  type: 'dealer';
}

export interface AdminPayload {
  adminId: string;
  username: string;
  type: 'admin';
}

declare global {
  namespace Express {
    interface Request {
      dealer?: DealerPayload;
      admin?: AdminPayload;
    }
  }
}

export function requireDealerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: DealerPayload & { iat?: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as DealerPayload & { iat?: number };
    if (payload.type !== 'dealer') {
      res.status(401).json({ success: false, message: 'Invalid token type' });
      return;
    }
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  // Check token revocation: if the dealer was blocked/suspended after this token
  // was issued, reject the request so the session cannot be continued.
  const tokenIssuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
  prisma.dealer
    .findUnique({ where: { id: payload.dealerId }, select: { lastRevokedAt: true } })
    .then((dealer) => {
      if (!dealer) {
        res.status(401).json({ success: false, message: 'Account not found' });
        return;
      }
      if (dealer.lastRevokedAt && tokenIssuedAt && dealer.lastRevokedAt > tokenIssuedAt) {
        res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        return;
      }
      req.dealer = payload;
      next();
    })
    .catch(() => {
      res.status(500).json({ success: false, message: 'Authentication check failed' });
    });
}

/**
 * Verify an admin Bearer token without writing a response. Returns the payload, or
 * null if the header is missing/malformed, the token is invalid/expired, or it is
 * not an admin token. Shared by `requireAdminAuth` and the RBAC permission guards so
 * authorization can run regardless of middleware ordering.
 */
export function authenticateAdminToken(req: Request): AdminPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as AdminPayload;
    if (payload.type !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = authenticateAdminToken(req);
  if (!payload) {
    res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
    return;
  }
  req.admin = payload;
  next();
}

export function generateDealerToken(dealerId: string, mobile: string): string {
  const expiry = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(
    { dealerId, mobile, type: 'dealer' } as DealerPayload,
    JWT_SECRET,
    { expiresIn: expiry }
  );
}

export function generateAdminToken(adminId: string, username: string): string {
  // The token intentionally carries NO role/permission data. Authorization is looked
  // up fresh from the DB on every request (see middleware/rbac.ts) so that revoking a
  // permission or deactivating a user takes effect immediately, not after token expiry.
  return jwt.sign(
    { adminId, username, type: 'admin' } as AdminPayload,
    JWT_SECRET,
    { expiresIn: '12h' as jwt.SignOptions['expiresIn'] }
  );
}
