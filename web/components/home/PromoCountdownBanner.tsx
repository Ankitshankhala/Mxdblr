'use client';

/**
 * PromoCountdownBanner — homepage urgency banner with a live countdown timer.
 *
 * Pattern borrowed from same-niche competitor benchmarking (Gaffarwala,
 * greatchoice.co.in both run "sale ends in HH:MM:SS" banners for active
 * promotions). This is a static/config-driven version: `PROMO` below defines
 * one offer and its end time. No backend model exists yet for admin-managed
 * promotions — this is the fast, no-client-content-needed version.
 *
 * TODO(client/admin): if recurring promos are wanted, this should become an
 * admin-editable banner type (title, discount, end date) rather than a
 * hardcoded constant — flag to the dev team if that's worth building out.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

interface Promo {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  /** ISO timestamp the countdown targets. */
  endsAt: string;
}

// Default: 48 hours from module load, so the countdown always shows a live,
// non-expired window in dev/preview. Replace `endsAt` with a real promotion
// end date before launch.
const DEFAULT_ENDS_AT = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

const PROMO: Promo = {
  title: 'Bulk Order Week',
  subtitle: 'Extra dealer discount on orders of 50+ units across all categories.',
  ctaLabel: 'Shop the Catalog',
  ctaHref: '/catalog',
  endsAt: DEFAULT_ENDS_AT,
};

function getTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 8,
          padding: '8px 10px',
          fontWeight: 900,
          fontSize: 18,
          color: '#fff',
          minWidth: 44,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

export default function PromoCountdownBanner() {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    setTimeLeft(getTimeLeft(PROMO.endsAt));
    const id = setInterval(() => setTimeLeft(getTimeLeft(PROMO.endsAt)), 1000);
    return () => clearInterval(id);
  }, []);

  // Expired or not-yet-mounted (SSR-safe: renders nothing extra on server) —
  // don't show a dead/zeroed countdown once the promo window has passed.
  if (timeLeft === null) return null;

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #1A1A2E 0%, #2A1A0E 100%)',
          borderRadius: 16,
          padding: '28px 32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(244,121,32,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={20} color="#F47920" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.01em' }}>
              {PROMO.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              {PROMO.subtitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TimeBox value={timeLeft.days} label="Days" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 900, fontSize: 18 }}>:</span>
          <TimeBox value={timeLeft.hours} label="Hrs" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 900, fontSize: 18 }}>:</span>
          <TimeBox value={timeLeft.minutes} label="Min" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 900, fontSize: 18 }}>:</span>
          <TimeBox value={timeLeft.seconds} label="Sec" />
        </div>

        <Link
          href={PROMO.ctaHref}
          className="btn-orange"
          style={{ padding: '12px 24px', fontSize: 14, borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          {PROMO.ctaLabel}
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
