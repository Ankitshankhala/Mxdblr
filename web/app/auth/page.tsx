'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authApi, setToken } from '@/lib/api';

type Step = 'mobile' | 'otp' | 'done';

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [shake, setShake] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.sendOtp(mobile);
      setStep('otp');
      setCountdown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await authApi.sendOtp(mobile);
      setCountdown(30);
      setOtp(['', '', '', '', '', '']);
      setError('');
      otpRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== '')) {
      submitOtp(newOtp.join(''));
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function submitOtp(otpString: string) {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(mobile, otpString);
      const data = res.data;

      if (data.newDealer) {
        // Store mobile for registration
        sessionStorage.setItem('mxd_reg_mobile', mobile);
        router.push('/register');
        return;
      }

      setToken(data.token);
      localStorage.setItem('mxd_dealer', JSON.stringify(data.dealer));
      router.push('/catalog');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid OTP';
      setError(msg);
      setShake(true);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        setShake(false);
        otpRefs.current[0]?.focus();
      }, 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1A1A2E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontWeight: 900, fontSize: 36, color: '#F47920', letterSpacing: '-1px' }}>MXD®</div>
        <div style={{ fontSize: 11, color: '#6B6B7D', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>
          Members Only
        </div>
      </div>

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
        }}
      >
        <AnimatePresence mode="wait">
          {step === 'mobile' && (
            <motion.div
              key="mobile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h1 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Sign In</h1>
              <p style={{ color: '#6B6B7D', fontSize: 14, marginBottom: 28 }}>
                Enter your mobile number to continue
              </p>

              <form onSubmit={handleSendOtp}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B6B7D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                  {/* Country code — fixed width, no emoji, no clipping */}
                  <div
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
                    {/* CSS-only tricolour strip — no emoji, works everywhere */}
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', letterSpacing: '-0.01em' }}>
                      +91
                    </span>
                  </div>

                  {/* Phone number input */}
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setError('');
                    }}
                    placeholder="Enter 10-digit number"
                    maxLength={10}
                    autoFocus
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      outline: 'none',
                      padding: '14px 14px',
                      fontSize: 18,
                      fontWeight: 700,
                      background: 'transparent',
                      letterSpacing: '0.05em',
                      color: '#1A1A2E',
                    }}
                  />
                </div>

                {error && <p style={{ color: '#DC2626', fontSize: 12, marginBottom: 12 }}>{error}</p>}

                <button
                  type="submit"
                  className="btn-orange"
                  style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 8 }}
                  disabled={loading || mobile.length !== 10}
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#A8A39A', marginTop: 20 }}>
                New dealer? You can register after OTP verification.
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
              <button
                type="button"
                onClick={() => { setStep('mobile'); setOtp(['', '', '', '', '', '']); setError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B7D', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 20 }}
              >
                <ArrowLeft size={14} /> Change number
              </button>

              <h1 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Enter OTP</h1>
              <p style={{ color: '#6B6B7D', fontSize: 14, marginBottom: 28 }}>
                6-digit OTP sent to +91 {mobile.slice(0, 5)}XXXXX
              </p>

              <motion.div
                animate={shake ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="tel"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: 44,
                      height: 52,
                      textAlign: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      border: `2px solid ${error ? '#DC2626' : digit ? '#F47920' : '#E8E4DE'}`,
                      borderRadius: 10,
                      outline: 'none',
                      background: digit ? '#FFF3E8' : '#F8F6F2',
                      color: '#1A1A2E',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  />
                ))}
              </motion.div>

              {error && <p style={{ color: '#DC2626', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

              {loading && (
                <p style={{ textAlign: 'center', color: '#F47920', fontSize: 13, marginBottom: 12 }}>Verifying...</p>
              )}

              {/* Resend */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                {countdown > 0 ? (
                  <span style={{ fontSize: 13, color: '#A8A39A' }}>
                    Resend in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F47920', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#6B6B7D', textAlign: 'center' }}>
        Dealer portal for Karnataka · Tamil Nadu · Andhra Pradesh
      </p>
    </div>
  );
}
