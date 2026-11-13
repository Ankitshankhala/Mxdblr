'use client';

/**
 * HowItWorks — homepage section explaining the dealer flow (register → browse →
 * inquire via WhatsApp) as numbered steps.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { whatsappLink } from '@/lib/config';

// Do not hard-code a catalog count in these steps — a stated number goes stale
// the moment the admin adds a category or product. This step previously read
// "1,200+ SKUs" against a catalog of 68, then "12 categories" against 16. The
// count is passed in from the homepage's live /categories fetch, and the copy
// drops the number entirely when that fetch fails.
const steps = (categoryCount?: number) => [
  {
    step: '01',
    title: 'Register as a Dealer',
    desc: 'Takes about 2 minutes. You will need your mobile number and basic shop details; a GST number is optional. Most applications are reviewed within 24 hours.',
    cta: { label: 'Register as a Dealer', href: '/register' },
  },
  {
    step: '02',
    title: 'Browse the Catalog',
    // Brand filtering is not mentioned because the compatibility filter is
    // currently hidden (see FilterSidebar.tsx).
    desc: categoryCount
      ? `Explore the full catalog across ${categoryCount} categories. Filter by category and availability.`
      : 'Explore the full catalog. Filter by category and availability.',
    cta: { label: 'Browse Catalog', href: '/catalog' },
  },
  {
    step: '03',
    title: 'Order via WhatsApp',
    desc: 'Add items to your cart and send an inquiry. Our team confirms pricing and dispatch the same business day.',
    cta: { label: 'WhatsApp Us', href: whatsappLink() },
  },
];

/** `categoryCount` comes from the homepage's live /categories fetch; omit it
 *  (or pass 0) and the catalog step renders without a number. */
export default function HowItWorks({ categoryCount }: { categoryCount?: number }) {
  const STEPS = steps(categoryCount);

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 20px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p
          style={{
            fontSize: 11,
            color: '#F47920',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 10,
          }}
        >
          Getting Started
        </p>
        <h2 style={{ fontWeight: 900, fontSize: 24, color: '#1F1813', letterSpacing: '-0.02em', marginBottom: 8 }}>
          How It Works
        </h2>
        <p style={{ fontSize: 14, color: '#6E6257' }}>Start buying wholesale in three simple steps.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#F47920')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#E8E4DE')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#F47920',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 14,
                  flexShrink: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {s.step}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1F1813', margin: 0, lineHeight: 1.3 }}>
                {s.title}
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#6E6257', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>

            <Link
              href={s.cta.href}
              style={{
                marginTop: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: '#F47920',
                textDecoration: 'none',
              }}
            >
              {s.cta.label}
              <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
