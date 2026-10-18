/**
 * Small dealer-login helpers shared by the login page, the header and the API
 * client: the mobile-number rule, the masked number shown on screen, and the
 * ?redirect= round trip (only same-site paths are ever followed).
 */

/** A 10-digit Indian mobile number, as the API validates it. */
export const MOBILE_RE = /^[6-9]\d{9}$/;

/** Where a dealer lands after signing in when nothing else was asked for. */
export const DEFAULT_AFTER_LOGIN = '/catalog';

/** "9876543210" -> "+91 XXXXX XX210". */
export function maskPhone(mobile: string): string {
  return `+91 XXXXX XX${mobile.slice(-3)}`;
}

/**
 * A ?redirect= value that is safe to navigate to: a path on this site, never
 * another origin ("//evil.com", "/\evil.com", "https://..."), never back to /auth.
 */
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_AFTER_LOGIN;
  if (raw === '/auth' || raw.startsWith('/auth?') || raw.startsWith('/auth/')) return DEFAULT_AFTER_LOGIN;
  return raw;
}

/** /auth, with a ?redirect= back to `path` (default: the page the visitor is on). */
export function loginPath(path?: string): string {
  const back = path ?? (typeof window === 'undefined' ? '' : window.location.pathname + window.location.search);
  if (!back || back === '/' || back === '/auth' || back.startsWith('/auth?')) return '/auth';
  return `/auth?redirect=${encodeURIComponent(back)}`;
}
