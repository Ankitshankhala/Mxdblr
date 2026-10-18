/**
 * express-rate-limit configurations used across the API.
 *
 * - apiRateLimit: global throttle (120 req/min) mounted on /api in index.ts.
 * - otpRateLimit: caps login-code sends per IP (5 per 10 min) to limit WhatsApp
 *   cost/abuse. routes/auth.ts adds per-number limits on top.
 * - otpVerifyRateLimit / adminLoginRateLimit: brute-force guards on failed
 *   attempts (successful attempts are not counted). Each login code also locks
 *   after 5 wrong guesses (routes/auth.ts), so guessing is infeasible.
 * The two OTP limiters answer { error: 'too_many_requests', retryAfter } so the
 * login screen can show the wait.
 * Relies on `app.set('trust proxy', 1)` (index.ts) for correct client IPs.
 */
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

function tooManyRequests(message: string) {
  return (req: Request, res: Response): void => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : undefined;
    res.status(429).json({ success: false, error: 'too_many_requests', message, ...(retryAfter && { retryAfter }) });
  };
}

export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests('Too many code requests. Please wait before trying again.'),
});

// Per IP, failed guesses only. Above the 5-per-code lock so that after a code
// locks the dealer can still request a new one and enter it from the same phone.
export const otpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only counts failed/invalid attempts
  handler: tooManyRequests('Too many verification attempts. Please wait before trying again.'),
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

// Tight brute-force guard on admin login: 5 failed attempts per 15 min.
// Successful logins are not counted (skipSuccessfulRequests: true).
export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});
