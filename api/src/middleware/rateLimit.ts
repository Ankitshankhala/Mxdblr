import rateLimit from 'express-rate-limit';

export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 10 minutes before trying again.',
  },
});

// Tight limit on verify-otp: 5 wrong guesses per 15 min renders brute-force
// impossible — the OTP expires in 5 min before a second window opens.
export const otpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only counts failed/invalid attempts
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait 15 minutes before trying again.',
  },
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
