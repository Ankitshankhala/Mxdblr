/**
 * LegalPage — shared shell for the static legal documents (/privacy, /terms).
 *
 * Kept deliberately plain: these pages are read by dealers and by platform
 * reviewers (Meta business verification requires a reachable Privacy Policy
 * URL), so they favour legibility over styling.
 */
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import Footer from '@/components/layout/Footer';

export const LAST_UPDATED = '26 August 2026';

export default function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 0' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', color: '#1F1813', marginBottom: 10 }}>
          {title}
        </h1>
        <p style={{ fontSize: 12, color: '#A8A39A', fontWeight: 600, marginBottom: 20 }}>
          Last updated: {LAST_UPDATED}
        </p>
        <p style={{ fontSize: 15, color: '#6E6257', lineHeight: 1.75, marginBottom: 28 }}>{intro}</p>

        <div
          style={{
            background: '#fff',
            border: '1px solid #E8E4DE',
            borderRadius: 14,
            padding: '28px 28px 8px',
          }}
        >
          {children}
        </div>
      </main>

      <div style={{ height: 60 }} />
      <Footer />
    </div>
  );
}

export function Clause({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1F1813', marginBottom: 8, letterSpacing: '-0.01em' }}>
        {heading}
      </h2>
      <div style={{ fontSize: 14, color: '#4A4A5E', lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}
