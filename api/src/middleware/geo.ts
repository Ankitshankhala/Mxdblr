/**
 * Geo-restriction gate — server-side, IP-based (the enforcement mechanism).
 *
 * geoCheckMiddleware resolves the client's state from their IP (ipapi.co over
 * HTTPS, 3s timeout) and 403s anyone outside the allowed states. This is the
 * REAL control: it never trusts a user-supplied state field (the registration
 * dropdown is convenience only). Allowed states come from the geoRestriction
 * table, falling back to DEFAULT_ALLOWED_STATES. Fails OPEN — local/private IPs,
 * lookup timeouts, or API outages let the request through so legitimate users
 * are never hard-blocked by infra failure. In development the gate is bypassed.
 */
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const DEFAULT_ALLOWED_STATES = ['Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana'];

export async function geoCheckMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = extractClientIp(req);
    const state = await getClientState(ip);
    // If state lookup fails (local IP, API timeout) — fail open so legitimate
    // users on private networks or during external API outages are not blocked.
    if (!state) { next(); return; }
    const allowed = await checkStateAllowed(state);
    if (!allowed) {
      res.status(403).json({
        success: false,
        message: 'Service is not available in your region.',
      });
      return;
    }
    next();
  } catch {
    next(); // fail open on unexpected errors
  }
}

export async function checkStateAllowed(state: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;
  const normalised = state.trim();
  try {
    const restriction = await prisma.geoRestriction.findFirst({
      where: { state: normalised, district: '' },
    });
    if (restriction) return restriction.allowed;
    return DEFAULT_ALLOWED_STATES.some((s) => s.toLowerCase() === normalised.toLowerCase());
  } catch {
    return false;
  }
}

export async function getClientState(ip: string): Promise<string | null> {
  // Skip lookup for local/private IPs
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return null;
  }

  try {
    // ipapi.co free tier — HTTPS, 1000 req/day free
    const response = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const data = await response.json() as { region?: string; error?: boolean };
    if (data.error || !data.region) return null;
    return data.region;
  } catch {
    return null;
  }
}

export function extractClientIp(req: Request): string {
  // With `app.set('trust proxy', 1)` set in index.ts, Express populates req.ip
  // correctly from the X-Forwarded-For header after validating the proxy chain.
  // Falling back to socket address for local/test environments where req.ip may be undefined.
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}
