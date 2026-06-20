'use client';

/**
 * Testimonials — homepage carousel/grid of dealer testimonials. Content is a
 * local static array (placeholder copy until real testimonials are supplied).
 */
const TESTIMONIALS = [
  {
    name: 'Rajesh Kumar',
    shop: 'RK Mobile Store, Bengaluru',
    text: 'Been sourcing from MXD for over 2 years. The quality is consistent, MOQ is flexible, and their WhatsApp team responds faster than any other distributor I work with.',
    rating: 5,
  },
  {
    name: 'Priya Sundaram',
    shop: 'Priya Accessories, Chennai',
    text: 'MXD helped me expand my catalog without overstocking. I started with just 5 units of each product and gradually scaled. Delivery to Chennai is always next day.',
    rating: 5,
  },
  {
    name: 'Mohammed Farhan',
    shop: 'FM Electronics, Vijayawada',
    text: 'The catalog portal makes it so easy to check stock before ordering. No more calling around to check availability. The data cables and chargers move very fast in my area.',
    rating: 5,
  },
];

export default function Testimonials() {
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
          Dealer Network
        </p>
        <h2
          style={{
            fontWeight: 900,
            fontSize: 24,
            color: '#1A1A2E',
            letterSpacing: '-0.02em',
            marginBottom: 8,
          }}
        >
          What Dealers Say
        </h2>
        <p style={{ fontSize: 14, color: '#6B6B7D' }}>Real feedback from our registered dealer network.</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {TESTIMONIALS.map((t, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
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
            {/* Quote mark accent */}
            <div
              style={{
                fontSize: 40,
                lineHeight: 1,
                color: '#F47920',
                opacity: 0.18,
                fontFamily: 'Georgia, serif',
                fontWeight: 900,
                marginBottom: -8,
              }}
            >
              &ldquo;
            </div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: t.rating }).map((_, j) => (
                <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#F47920">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>

            <p style={{ fontSize: 13, color: '#4A4A5A', lineHeight: 1.75, margin: 0, flex: 1 }}>
              {t.text}
            </p>

            <div style={{ borderTop: '1px solid #E8E4DE', paddingTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>{t.name}</div>
              <div style={{ fontSize: 11, color: '#A8A39A', marginTop: 2 }}>{t.shop}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
