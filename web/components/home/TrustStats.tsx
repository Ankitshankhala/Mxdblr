/**
 * TrustStats — homepage band of headline metrics (dealers, SKUs, coverage,
 * turnaround). Static, presentational, server-safe (no client directive).
 */
import { Users, Package, MapPin } from 'lucide-react';

/**
 * WhatsApp brand glyph (lucide ships no brand icons). Same path used by the
 * FloatingWhatsApp widget. Mirrors the lucide icon API (size/color props) so it
 * drops into the STATS map like any other icon.
 */
function WhatsAppIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zM12.04 20.15h-.003a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}

// Launch safety (CRIT-5): unverifiable COUNT stats (dealers, SKUs) must never
// ship as invented figures. They are env-driven and hidden until set — provide
// real values via NEXT_PUBLIC_STAT_DEALERS / NEXT_PUBLIC_STAT_SKUS at build time
// and they appear. The qualitative facts (coverage, dispatch) are confirmable
// business claims, also env-overridable. Any stat with an empty value is omitted;
// if none remain, the whole band is hidden.
const STATS = [
  { value: process.env.NEXT_PUBLIC_STAT_DEALERS || '', label: 'Registered Dealers', Icon: Users },
  { value: process.env.NEXT_PUBLIC_STAT_SKUS || '', label: 'SKUs in Catalog', Icon: Package },
  { value: process.env.NEXT_PUBLIC_STAT_COVERAGE || '3 States', label: 'Coverage Area', Icon: MapPin },
  { value: process.env.NEXT_PUBLIC_STAT_DISPATCH || 'Same-Day', label: 'Dispatch from Bengaluru', Icon: WhatsAppIcon },
].filter((s) => s.value.trim() !== '');

export default function TrustStats() {
  if (STATS.length === 0) return null;
  return (
    <section style={{ background: '#1F1813', padding: '0 20px', marginTop: 60 }}>
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
