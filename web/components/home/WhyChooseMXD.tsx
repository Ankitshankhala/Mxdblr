'use client';

/**
 * WhyChooseMXD — homepage value-proposition grid (range, speed, delivery,
 * coverage, trust, pricing). Static presentational section.
 */
import { Package, Zap, Truck, MapPin, ShieldCheck, Tag } from 'lucide-react';

const BENEFITS = [
  {
    Icon: Package,
    color: '#FFF3E8',
    iconColor: '#F47920',
    title: 'MOQ as Low as 5 Units',
    desc: 'No massive bulk-order requirements. Start small, test the market, and scale at your own pace.',
  },
  {
    Icon: Zap,
    color: '#EEF0FE',
    iconColor: '#6366F1',
    title: 'Fast WhatsApp Response',
    desc: 'Dedicated support team confirms pricing and availability on the same business day.',
  },
  {
    Icon: Truck,
    color: '#E6F3E7',
    iconColor: '#2E7D32',
    title: 'Same-Day Dispatch',
    desc: 'Orders placed before 3 PM are dispatched the same day from our Bengaluru warehouse.',
  },
  {
    Icon: MapPin,
    color: '#FEF3D7',
    iconColor: '#F59E0B',
    title: 'South India Coverage',
    desc: 'Serving Karnataka, Tamil Nadu & Andhra Pradesh with delivery to 100+ pin codes.',
  },
  {
    Icon: ShieldCheck,
    color: '#FCE7E7',
    iconColor: '#DC2626',
    title: '100% Genuine Products',
    desc: 'Sourced directly from manufacturers. Every SKU is quality-checked before dispatch.',
  },
  {
    Icon: Tag,
    color: '#FFF3E8',
    iconColor: '#F47920',
    title: 'Dealer-Exclusive Pricing',
    desc: 'Registered dealers unlock tiered wholesale pricing unavailable to the general public.',
  },
];

export default function WhyChooseMXD() {
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
          Why MXD
        </p>
        <h2 style={{ fontWeight: 800, fontSize: 24, color: '#1A1A2E', letterSpacing: '-0.02em' }}>
          Why Dealers Choose MXD
        </h2>
        <p style={{ fontSize: 14, color: '#6B6B7D', marginTop: 8, maxWidth: 440, margin: '8px auto 0' }}>
          Built for retailers who need reliability, not just products.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {BENEFITS.map((b, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '22px 20px',
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#F47920';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(244,121,32,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E4DE';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: b.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <b.Icon size={20} color={b.iconColor} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', marginBottom: 5 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: '#6B6B7D', lineHeight: 1.65 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
