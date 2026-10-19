/**
 * JWT authentication for the two distinct identity types: dealers and admins.
 *
 * Tokens are type-tagged ('dealer' | 'admin') and the guards reject cross-type
 * use, so a dealer token can never reach an admin route and vice versa.
 * - requireDealerAuth also enforces token revocation (dealer.lastRevokedAt) so a
 *   blocked/suspended dealer's existing session stops working immediately.
 * - Dealer sessions last DEALER_SESSION_DAYS (90 by default) and GET /auth/me
 *   renews them on each visit, so a dealer only signs in again after that long
 *   away, after pressing Logout, or after an admin blocks them.
 * - Dealer tokens arrive in the httpOnly session cookie (lib/session.ts) from the
 *   storefront, or as a Bearer header (tests, tools). A cookie whose token no
 *   longer works is cleared along with the 401, so the storefront sees signed-out.
 * - Admin tokens deliberately carry NO role/permission data; authorization is
 *   looked up fresh from the DB on every request (see middleware/rbac.ts), so
 *   permission/active changes take effect at once rather than at token expiry.
 * authenticateAdminToken is the response-free verifier shared with the RBAC guards.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { clearSessionCookie, readSessionCookie } from '../lib/session';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface DealerPayload {
  dealerId: string;
  mobile: string;
  type: 'dealer';
  /** Issued-at (seconds), set by jwt.sign. */
  iat?: number;
}

/** Days a dealer stays signed in without visiting the site. */
export const DEALER_SESSION_DAYS = Number(process.env.DEALER_SESSION_DAYS) || 90;

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

/** The dealer token on this request: Bearer header first, then the session cookie. */
export function readDealerToken(req: Request): { token: string; fromCookie: boolean } | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return { token: authHeader.slice(7), fromCookie: false };
  const cookie = readSessionCookie(req);
  return cookie ? { token: cookie, fromCookie: true } : null;
}

export function requireDealerAuth(req: Request, res: Response, next: NextFunction): void {
  const found = readDealerToken(req);
  if (!found) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const reject = (message: string) => {
    if (found.fromCookie) clearSessionCookie(req, res);
    res.status(401).json({ success: false, message });
  };

  let payload: DealerPayload & { iat?: number };
  try {
    payload = jwt.verify(found.token, JWT_SECRET) as DealerPayload & { iat?: number };
    if (payload.type !== 'dealer') {
      reject('Invalid token type');
      return;
    }
  } catch {
    reject('Invalid or expired token');
    return;
  }

  // Check token revocation: if the dealer was blocked/suspended after this token
  // was issued, reject the request so the session cannot be continued.
  const tokenIssuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
  prisma.dealer
    .findUnique({ where: { id: payload.dealerId }, select: { lastRevokedAt: true } })
    .then((dealer) => {
      if (!dealer) {
        reject('Account not found');
        return;
      }
      if (dealer.lastRevokedAt && tokenIssuedAt && dealer.lastRevokedAt > tokenIssuedAt) {
        reject('Session expired. Please log in again.');
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
  return jwt.sign(
    { dealerId, mobile, type: 'dealer' } as DealerPayload,
    JWT_SECRET,
    { expiresIn: DEALER_SESSION_DAYS * 24 * 60 * 60 }
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
