'use client';

/**
 * DealerCTABanner — homepage call-to-action banner prompting visitors to
 * register as a dealer (links to /register).
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { whatsappLink } from '@/lib/config';

export default function DealerCTABanner() {
  return (
    <section style={{ padding: '60px 20px 0' }}>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          background: '#1F1813',
          borderRadius: 20,
          padding: '56px 48px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blurred circles — matches HeroBanner style */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: '#F47920',
            opacity: 0.06,
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: '35%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: '#F47920',
            opacity: 0.04,
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 560, position: 'relative' }}>
          {/* Accent pill — matches HeroBanner accent pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(244,121,32,0.15)',
              color: '#F47920',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 12px',
              borderRadius: 999,
              marginBottom: 18,
              border: '1px solid rgba(244,121,32,0.3)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F47920', display: 'inline-block' }} />
            For Retailers &amp; Wholesalers
          </div>

          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 36px)',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.15,
              marginBottom: 14,
              letterSpacing: '-0.02em',
            }}
          >
            Become a Registered{' '}
            <span style={{ color: '#F47920' }}>MXD Dealer</span>
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
            Access wholesale pricing, exclusive stock alerts, and priority WhatsApp support across Karnataka, Tamil Nadu &amp; Andhra Pradesh.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
          <Link
            href="/register"
            className="btn-orange"
            style={{ padding: '14px 32px', fontSize: 15, borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            Register as a Dealer
            <ArrowRight size={16} />
          </Link>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Takes ~2 min · Valid GST number required
          </p>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.7)',
              padding: '12px 28px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.61L0 24l6.545-1.376A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.785 9.785 0 0 1-5.032-1.392l-.36-.214-3.733.785.799-3.648-.235-.374A9.779 9.779 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
            WhatsApp Us First
          </a>
        </div>
      </div>
    </section>
  );
}
