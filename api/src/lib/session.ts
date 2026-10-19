/**
 * Dealer session cookie. The dealer JWT lives in an httpOnly cookie that page
 * scripts cannot read, so a script injected into the storefront cannot steal it.
 *
 * Set by POST /auth/verify-otp and /auth/register, read by requireDealerAuth,
 * cleared by POST /auth/logout (and by requireDealerAuth when the token it holds
 * no longer works). The storefront (mxdblr.com) and the API (api.mxdblr.com)
 * share it through the cookie Domain: COOKIE_DOMAIN when set, otherwise the
 * API host minus its first label (api.mxdblr.com -> mxdblr.com). On localhost
 * the cookie is host-only, which browsers already share across ports.
 */
import { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'mxd_session';

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function cookieDomain(req: Request): string | undefined {
  const configured = process.env.COOKIE_DOMAIN?.trim();
  if (configured) return configured;
  const host = req.hostname;
  if (!host || IPV4_RE.test(host) || host.includes(':')) return undefined;
  const labels = host.split('.');
  return labels.length >= 3 ? labels.slice(1).join('.') : undefined;
}

function cookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain(req),
  };
}

/** Stores the token; the cookie expires when the token does (DEALER_SESSION_DAYS, 90 by default). */
export function setSessionCookie(req: Request, res: Response, token: string): void {
  const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(req),
    ...(exp ? { expires: new Date(exp * 1000) } : { maxAge: 7 * 24 * 60 * 60 * 1000 }),
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

/** The session token from the Cookie header, or null. No cookie-parser needed for one cookie. */
export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}
