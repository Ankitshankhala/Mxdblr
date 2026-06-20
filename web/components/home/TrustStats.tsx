import { Users, Package, MapPin, Zap } from 'lucide-react';

const STATS = [
  { value: '500+', label: 'Registered Dealers', Icon: Users },
  { value: '1,200+', label: 'SKUs in Catalog', Icon: Package },
  { value: '3 States', label: 'Coverage Area', Icon: MapPin },
  { value: '< 2 hrs', label: 'WhatsApp Response', Icon: Zap },
];

export default function TrustStats() {
  return (
    <section style={{ background: '#1A1A2E', padding: '0 20px' }}>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {STATS.map((s, i) => (
          <div
            key={i}
            style={{
              padding: '36px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 12,
              borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(244,121,32,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <s.Icon size={22} color="#F47920" />
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
