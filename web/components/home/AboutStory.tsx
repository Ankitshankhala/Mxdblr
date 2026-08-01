'use client';

/**
 * AboutStory — homepage business-credibility section (CRO review addition).
 *
 * TODO(client): this ships with structure only, not real content. Replace
 * `STORY_TEXT` with the real founding story, and add a real warehouse/team
 * photo where the placeholder block is. B2B buyers deciding whether to trust
 * an unfamiliar wholesale supplier respond far more to a real photo + real
 * human name than to another icon grid or stat — this section exists to hold
 * that space once real assets are available. Do not launch with invented
 * biographical details; leave the placeholder visible/obvious until then.
 */
const STORY_TEXT =
  '[PLACEHOLDER — replace with the real founding story: who started MXD, ' +
  'when, why, and what makes the Bengaluru warehouse operation trustworthy ' +
  'to a dealer who has never ordered from us before.]';

export default function AboutStory() {
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '60px 20px 0' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 40,
          background: '#fff',
          border: '1px solid #E8E4DE',
          borderRadius: 20,
          padding: '40px',
        }}
      >
        {/* Photo placeholder — replace with a real warehouse/team photo */}
        <div
          style={{
            flex: '1 1 320px',
            minHeight: 240,
            borderRadius: 14,
            background: '#F8F6F2',
            border: '1px dashed #D8D3CB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 20,
            color: '#A8A39A',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Real warehouse / team photo goes here
        </div>

        <div style={{ flex: '1 1 360px' }}>
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
            Who We Are
          </p>
          <h2
            style={{
              fontWeight: 900,
              fontSize: 24,
              color: '#1A1A2E',
              letterSpacing: '-0.02em',
              marginBottom: 16,
            }}
          >
            A Real Warehouse, Not a Reseller
          </h2>
          <p style={{ fontSize: 14, color: '#6B6B7D', lineHeight: 1.75 }}>{STORY_TEXT}</p>
        </div>
      </div>
    </section>
  );
}
