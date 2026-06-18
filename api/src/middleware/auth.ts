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
  role: string;
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

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Admin authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminPayload;
    if (payload.type !== 'admin') {
      res.status(401).json({ success: false, message: 'Admin token required' });
      return;
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
}

export function generateDealerToken(dealerId: string, mobile: string): string {
  const expiry = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(
    { dealerId, mobile, type: 'dealer' } as DealerPayload,
    JWT_SECRET,
    { expiresIn: expiry }
  );
}

export function generateAdminToken(adminId: string, username: string, role: string): string {
  return jwt.sign(
    { adminId, username, role, type: 'admin' } as AdminPayload,
    JWT_SECRET,
    { expiresIn: '12h' as jwt.SignOptions['expiresIn'] }
  );
}
