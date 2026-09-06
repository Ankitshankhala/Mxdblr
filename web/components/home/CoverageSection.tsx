'use client';

/**
 * CoverageSection — homepage section showing the served regions (Karnataka,
 * Tamil Nadu, Andhra Pradesh, …), matching the geo-restriction policy.
 */
import { MapPin } from 'lucide-react';
import { whatsappLink } from '@/lib/config';

const STATES = [
  {
    name: 'Karnataka',
    districts: '30+',
    highlight: 'Bengaluru · Mysuru · Hubli · Mangaluru',
    tag: 'Primary Hub',
  },
  {
    name: 'Tamil Nadu',
    districts: '20+',
    highlight: 'Chennai · Coimbatore · Madurai · Salem',
    tag: 'Active Coverage',
  },
  {
    name: 'Andhra Pradesh',
    districts: '15+',
    highlight: 'Vijayawada · Visakhapatnam · Tirupati',
    tag: 'Active Coverage',
  },
];

export default function CoverageSection() {
  return (
    <section style={{ background: '#1F1813', padding: '60px 20px', marginTop: 60 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
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
            Service Area
          </p>
          <h2
            style={{
              fontWeight: 900,
              fontSize: 24,
              color: '#fff',
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}
          >
            Where We Deliver
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 440, margin: '0 auto' }}>
            Fast dispatch from Bengaluru to 65+ districts across South India.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {STATES.map((s, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '28px 24px',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(244,121,32,0.4)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              {/* Icon + tag row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(244,121,32,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={18} color="#F47920" />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#F47920',
                    background: 'rgba(244,121,32,0.12)',
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(244,121,32,0.25)',
                  }}
                >
                  {s.tag}
                </div>
              </div>

              <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.01em', marginBottom: 4 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 13, color: '#F47920', fontWeight: 700, marginBottom: 10 }}>
                {s.districts} Districts Covered
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                {s.highlight}
              </div>
            </div>
          ))}
        </div>

        {/* TODO(client): confirm real expansion timeline — "2025" has already
            passed and this claim is now stale/inaccurate if left as-is. */}
        <div style={{ textAlign: 'center', marginTop: 36, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Expanding to Kerala &amp; Telangana soon —{' '}
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#F47920', textDecoration: 'none', fontWeight: 600 }}
          >
            enquire on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
