/**
 * Dealer cookies. Both hold signed JWTs in httpOnly cookies that page scripts
 * cannot read, so a script injected into the storefront cannot steal them.
 *
 * - mxd_session: the signed-in session. Set by POST /auth/verify-otp,
 *   /auth/register and /auth/device-login, read by requireDealerAuth, cleared by
 *   POST /auth/logout (and by requireDealerAuth when its token no longer works).
 * - mxd_device: "this phone is remembered" for number-only login. Set alongside
 *   the session at every sign-in and deliberately kept on logout, so the dealer
 *   can sign back in on this phone with just their number (POST /auth/device-login).
 *
 * The storefront (mxdblr.com) and the API (api.mxdblr.com) share them through the
 * cookie Domain: COOKIE_DOMAIN when set, otherwise the API host minus its first
 * label (api.mxdblr.com -> mxdblr.com). On localhost the cookies are host-only,
 * which browsers already share across ports.
 */
import { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'mxd_session';
export const DEVICE_COOKIE = 'mxd_device';

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

/** Stores a token in `name`; the cookie expires when the token does. */
function setTokenCookie(name: string, req: Request, res: Response, token: string): void {
  const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
  res.cookie(name, token, {
    ...cookieOptions(req),
    ...(exp ? { expires: new Date(exp * 1000) } : { maxAge: 7 * 24 * 60 * 60 * 1000 }),
  });
}

/** A cookie's value from the Cookie header, or null. No cookie-parser needed for two cookies. */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The session lasts DEALER_SESSION_DAYS (90 by default), renewed on each visit. */
export function setSessionCookie(req: Request, res: Response, token: string): void {
  setTokenCookie(SESSION_COOKIE, req, res, token);
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

export function readSessionCookie(req: Request): string | null {
  return readCookie(req, SESSION_COOKIE);
}

/** The phone stays remembered for TRUSTED_DEVICE_DAYS after its last sign-in. */
export function setDeviceCookie(req: Request, res: Response, token: string): void {
  setTokenCookie(DEVICE_COOKIE, req, res, token);
}

export function clearDeviceCookie(req: Request, res: Response): void {
  res.clearCookie(DEVICE_COOKIE, cookieOptions(req));
}

export function readDeviceCookie(req: Request): string | null {
  return readCookie(req, DEVICE_COOKIE);
}
