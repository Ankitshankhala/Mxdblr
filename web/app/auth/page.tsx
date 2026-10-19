'use client';

/**
 * Dealer login page (route: /auth). Two steps on the site's own API:
 * 1. Phone — +91 and a 10-digit mobile; POST /api/auth/send-otp sends a 6-digit
 *    code on WhatsApp and says how long it lasts (expiresIn) and when another
 *    may be sent (resendIn).
 * 2. Code — six boxes (typing advances, Backspace goes back, a pasted or
 *    autofilled code fills all six) auto-submitted to POST /api/auth/verify-otp.
 *    The API sets the httpOnly session cookie; this page never sees the token.
 *    New numbers go on to /register; everyone else to ?redirect= (same-site
 *    paths only) or /catalog.
 * A phone that verified once is remembered (GET /api/auth/device): its number is
 * pre-filled and "Log in" signs straight in with POST /api/auth/device-login, no
 * code. Another number, or a phone the API no longer remembers, gets the code.
 * API failures arrive as error codes and are shown inline in a live region.
 * AnimatePresence uses initial={false} so the form paints on first render even
 * if the enter animation doesn't fire.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, LogIn, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { authApi, type AuthApiError } from '@/lib/api';
import { MOBILE_RE, maskPhone, safeRedirect } from '@/lib/auth';
import { whatsappLink } from '@/lib/config';
import { useAuth } from '@/hooks/useAuth';

type Step = 'phone' | 'otp';

const CODE_LENGTH = 6;
const EMPTY_CODE = Array<string>(CODE_LENGTH).fill('');

/** "0:30", "9:59". */
function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The moment `seconds` from now, in ms (0 = now). Only called from event handlers. */
function deadline(seconds: number): number {
  return Date.now() + seconds * 1000;
}

/** "45s" for short waits, "58 min" for long ones. */
function wait(seconds: number): string {
  return seconds < 120 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`;
}

/** The API's error code as words for the dealer. */
function friendlyError(body: AuthApiError | undefined, fallback: string): string {
  switch (body?.error) {
    case 'invalid_phone':
      return 'Enter a valid 10-digit mobile number';
    case 'wait_before_resend':
    case 'too_many_otps':
    case 'too_many_requests':
      return body.retryAfter ? `Too many requests. Try again in ${wait(body.retryAfter)}` : 'Too many requests. Try again shortly.';
    case 'delivery_failed':
      return "Couldn't send on WhatsApp. Check the number has WhatsApp, or try again.";
    case 'invalid_otp': {
      const left = body.attemptsLeft ?? 0;
      return `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left`;
    }
    case 'too_many_attempts':
    case 'otp_expired_or_missing':
      return 'Code expired or locked. Please request a new one.';
    case 'invalid_input':
      return 'Enter the 6-digit code';
    default:
      return body?.message || fallback;
  }
}

function errorBody(err: unknown): AuthApiError | undefined {
  return (err as { response?: { data?: AuthApiError } })?.response?.data;
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zM12.04 20.15h-.003a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#6E6257', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  color: '#F47920', fontSize: 13, fontWeight: 600,
};

export default function AuthPage() {
  const router = useRouter();
  const { status, signIn } = useAuth();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>('phone');
  const [mobile, setMobile] = useState('');
  const [sentTo, setSentTo] = useState(''); // the number the live code went to
  const [remembered, setRemembered] = useState(''); // the number this phone can log in with, no code
  const [code, setCode] = useState<string[]>(EMPTY_CODE);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  // Absolute times (ms) so the countdowns stay right however often we render.
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const busy = useRef(false); // blocks double clicks and double auto-submits
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  const phoneValid = MOBILE_RE.test(mobile);
  const quickLogin = remembered !== '' && mobile === remembered;
  const resendIn = Math.max(0, (resendAt - now) / 1000);
  const expiresIn = Math.max(0, (expiresAt - now) / 1000);
  const expired = step === 'otp' && expiresAt > 0 && expiresIn <= 0;

  const target = useCallback(
    () => safeRedirect(new URLSearchParams(window.location.search).get('redirect')),
    []
  );

  // Already signed in (e.g. opened /auth from a bookmark): go straight on.
  useEffect(() => {
    if (status === 'authenticated') router.replace(target());
  }, [status, router, target]);

  // A phone that verified before: pre-fill its number for code-free "Log in".
  useEffect(() => {
    authApi
      .device()
      .then(({ data }) => {
        if (!data.mobile) return;
        setRemembered(data.mobile);
        setMobile((current) => current || data.mobile!);
      })
      .catch(() => {
        /* not remembered: the usual code flow */
      });
  }, []);

  // One tick a second while a countdown is showing.
  useEffect(() => {
    if (step !== 'otp') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  function startTimers(data: { expiresIn: number; resendIn: number }) {
    setNow(deadline(0));
    setExpiresAt(deadline(data.expiresIn));
    setResendAt(deadline(data.resendIn));
  }

  function holdResend(body: AuthApiError | undefined) {
    if (body?.retryAfter) {
      setNow(deadline(0));
      setResendAt(deadline(body.retryAfter));
    }
  }

  function focusBox(i: number) {
    boxRefs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (!phoneValid) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    busy.current = true;
    setSending(true);
    setError('');
    try {
      if (quickLogin) {
        try {
          const { data } = await authApi.deviceLogin(mobile);
          signIn(data.dealer);
          router.replace(target());
          return;
        } catch (err) {
          if (errorBody(err)?.error !== 'otp_required') throw err;
          setRemembered(''); // the API no longer remembers this phone: use a code
        }
      }
      const { data } = await authApi.sendOtp(mobile);
      startTimers(data);
      setSentTo(mobile);
      setCode(EMPTY_CODE);
      setStep('otp'); // the first box focuses itself when the step mounts
    } catch (err) {
      const body = errorBody(err);
      if (body?.error === 'wait_before_resend' && sentTo === mobile && expiresAt > deadline(0)) {
        // Same number after "Edit number": the code already sent still works.
        holdResend(body);
        setStep('otp');
        return;
      }
      setError(friendlyError(body, "Couldn't send the code. Please try again."));
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  async function handleResend() {
    if (busy.current || resendIn > 0) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      const { data } = await authApi.sendOtp(mobile);
      startTimers(data);
      setCode(EMPTY_CODE);
      focusBox(0);
    } catch (err) {
      const body = errorBody(err);
      holdResend(body);
      setError(friendlyError(body, "Couldn't send the code. Please try again."));
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  function editNumber() {
    setStep('phone');
    setCode(EMPTY_CODE);
    setError(''); // the phone field focuses itself when the step mounts
  }

  async function submitCode(otp: string) {
    if (busy.current) return;
    busy.current = true;
    setVerifying(true);
    setError('');
    try {
      const { data } = await authApi.verifyOtp(mobile, otp);
      if (data.newDealer) {
        sessionStorage.setItem('mxd_reg_mobile', mobile);
        sessionStorage.setItem('mxd_login_redirect', target());
        router.push('/register');
        return;
      }
      signIn(data.dealer);
      router.replace(target());
    } catch (err) {
      const body = errorBody(err);
      setError(friendlyError(body, "Couldn't check the code. Please try again."));
      setCode(EMPTY_CODE);
      if (body?.error === 'too_many_attempts' || body?.error === 'otp_expired_or_missing') {
        // Back to the resend state: this code is finished.
        setExpiresAt(deadline(0));
      }
      if (!reduceMotion) {
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
      setTimeout(() => focusBox(0), 50);
    } finally {
      busy.current = false;
      setVerifying(false);
    }
  }

  /** Writes digits into the boxes from `start`; submits once all six are filled. */
  function fillFrom(start: number, digits: string) {
    const next = [...code];
    let i = start;
    for (const d of digits) {
      if (i >= CODE_LENGTH) break;
      next[i++] = d;
    }
    setCode(next);
    setError('');
    focusBox(i >= CODE_LENGTH ? CODE_LENGTH - 1 : i);
    if (next.every((d) => d !== '')) void submitCode(next.join(''));
  }

  function handleBoxChange(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const next = [...code];
      next[index] = '';
      setCode(next);
      return;
    }
    // A whole code at once is phone autofill or a paste: it starts at the first box.
    if (digits.length >= CODE_LENGTH) fillFrom(0, digits.slice(0, CODE_LENGTH));
    // Typing into a box that already had a digit: keep the new one.
    else if (digits.length === 2 && code[index]) fillFrom(index, digits[0] === code[index] ? digits[1] : digits[0]);
    else fillFrom(index, digits);
  }

  function handleBoxKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      e.preventDefault();
      const next = [...code];
      next[index - 1] = '';
      setCode(next);
      focusBox(index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusBox(index + 1);
    }
  }

  function handleBoxPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    fillFrom(digits.length >= CODE_LENGTH ? 0 : index, digits.slice(0, CODE_LENGTH));
  }

  const errorRegion = (id: string, align: 'left' | 'center') => (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      style={{ color: '#DC2626', fontSize: 13, marginBottom: error ? 12 : 0, textAlign: align }}
    >
      {error}
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1F1813',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Link href="/" aria-label="MXD home" style={{ display: 'flex', justifyContent: 'center' }}>
          <Logo height={44} preload />
        </Link>
        <div style={{ fontSize: 11, color: '#A8A39A', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>
          Members Only
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 'clamp(22px, 6vw, 32px)' }}>
        <AnimatePresence mode="wait" initial={false}>
          {step === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Sign In</h1>
              <p style={{ color: '#6E6257', fontSize: 14, marginBottom: 28 }}>
                {quickLogin
                  ? 'Welcome back. This phone is remembered, so no code is needed.'
                  : <>Enter your mobile number. We&rsquo;ll send a 6-digit code on WhatsApp.</>}
              </p>

              <form onSubmit={handleSendOtp} noValidate>
                <label htmlFor="auth-mobile" style={labelStyle}>
                  Mobile Number
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    border: `1px solid ${error ? '#DC2626' : '#E8E4DE'}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                    marginBottom: 8,
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Fixed +91 prefix */}
                  <div
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      minWidth: 72,
                      padding: '0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      background: '#F8F6F2',
                      borderRight: '1px solid #E8E4DE',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 13,
                        borderRadius: 2,
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid #E8E4DE',
                      }}
                    >
                      <div style={{ flex: 1, background: '#FF9933' }} />
                      <div style={{ flex: 1, background: '#fff' }} />
                      <div style={{ flex: 1, background: '#138808' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1F1813', letterSpacing: '-0.01em' }}>+91</span>
                  </div>

                  <input
                    id="auth-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={(e) => {
                      // Pasted "+91 98765 43210" or "098765..." keeps its last 10 digits.
                      const digits = e.target.value.replace(/\D/g, '');
                      setMobile(digits.length > 10 ? digits.slice(-10) : digits);
                      setError('');
                    }}
                    placeholder="10-digit mobile number"
                    aria-describedby="auth-phone-error"
                    aria-invalid={error ? true : undefined}
                    autoFocus
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      padding: '14px 14px',
                      fontSize: 18,
                      fontWeight: 700,
                      background: 'transparent',
                      letterSpacing: '0.05em',
                      color: '#1F1813',
                    }}
                  />
                </div>

                {errorRegion('auth-phone-error', 'left')}

                <button
                  type="submit"
                  className="btn-orange"
                  style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 8 }}
                  disabled={sending || !phoneValid}
                  aria-busy={sending}
                >
                  {sending ? (
                    <>
                      <span
                        aria-hidden="true"
                        style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
                      />
                      {quickLogin ? 'Logging in…' : 'Sending…'}
                    </>
                  ) : quickLogin ? (
                    <>
                      <LogIn size={18} aria-hidden="true" />
                      Log in
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon />
                      Send OTP on WhatsApp
                    </>
                  )}
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#6E6257', marginTop: 20 }}>
                New dealer? You can register after the code is verified.
              </p>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 id="auth-otp-title" style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Enter Code</h1>
              <p style={{ color: '#6E6257', fontSize: 14, marginBottom: 24 }}>
                Enter the 6-digit code sent to WhatsApp{' '}
                <strong style={{ color: '#1F1813', whiteSpace: 'nowrap' }}>{maskPhone(mobile)}</strong>{' '}
                <button type="button" onClick={editNumber} style={{ ...linkButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ArrowLeft size={13} aria-hidden="true" /> Edit number
                </button>
              </p>

              <motion.div
                role="group"
                aria-labelledby="auth-otp-title"
                aria-describedby="auth-otp-error"
                animate={shake ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: 'flex', gap: 'clamp(6px, 2vw, 8px)', marginBottom: 16, justifyContent: 'center' }}
              >
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    autoFocus={i === 0}
                    aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                    aria-invalid={error ? true : undefined}
                    value={digit}
                    disabled={verifying}
                    onChange={(e) => handleBoxChange(i, e.target.value)}
                    onKeyDown={(e) => handleBoxKeyDown(i, e)}
                    onPaste={(e) => handleBoxPaste(i, e)}
                    onFocus={(e) => e.target.select()}
                    style={{
                      width: 'clamp(38px, 11vw, 46px)',
                      height: 52,
                      padding: 0,
                      textAlign: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      border: `2px solid ${error ? '#DC2626' : digit ? '#F47920' : '#E8E4DE'}`,
                      borderRadius: 10,
                      background: digit ? '#FFF3E8' : '#F8F6F2',
                      color: '#1F1813',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  />
                ))}
              </motion.div>

              {errorRegion('auth-otp-error', 'center')}

              <p role="status" aria-live="polite" style={{ textAlign: 'center', fontSize: 13, color: verifying ? '#F47920' : expired ? '#B45309' : '#6E6257', marginBottom: 4, fontWeight: expired ? 600 : 400 }}>
                {verifying ? 'Verifying…' : expired ? 'Code expired — resend' : `Code expires in ${clock(expiresIn)}`}
              </p>

              {/* Resend */}
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={sending || verifying || resendIn > 0}
                  style={{
                    ...linkButtonStyle,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: resendIn > 0 || sending ? '#A8A39A' : '#F47920',
                    cursor: resendIn > 0 || sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  {sending ? 'Sending…' : resendIn > 0 ? `Resend in ${clock(resendIn)}` : 'Resend code'}
                </button>
              </div>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#6E6257', marginTop: 16 }}>
                No message?{' '}
                <a
                  href={whatsappLink(`Hi, I'm not receiving my MXD login code on WhatsApp. My number is ${mobile}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#F47920', fontWeight: 600 }}
                >
                  Message us on WhatsApp
                </a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #F0EDEA', fontSize: 12, color: '#6E6257', textAlign: 'center', lineHeight: 1.5 }}>
          By continuing you agree to our{' '}
          <Link href="/terms" style={{ color: '#F47920', fontWeight: 600 }}>Terms</Link> and{' '}
          <Link href="/privacy" style={{ color: '#F47920', fontWeight: 600 }}>Privacy Policy</Link>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#A8A39A', textAlign: 'center' }}>
        Dealer portal for Karnataka · Tamil Nadu · Andhra Pradesh
      </p>
    </div>
  );
}
