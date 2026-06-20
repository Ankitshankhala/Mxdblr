'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const FAQS = [
  {
    q: 'Who can register as an MXD dealer?',
    a: 'Any registered retail shop, wholesaler, distributor, or online seller dealing in mobile accessories in Karnataka, Tamil Nadu, or Andhra Pradesh can apply. You will need a valid GST number for registration.',
  },
  {
    q: 'What is the minimum order quantity (MOQ)?',
    a: 'MOQ starts as low as 5 units on select products. Each product page shows its specific MOQ. Bulk orders of 50+ units qualify for additional discount tiers.',
  },
  {
    q: 'How do I place an order?',
    a: 'Browse the catalog, add items to your cart, and click "Send Inquiry via WhatsApp." Our team will confirm the order, pricing, and dispatch timeline within 2 hours on business days.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Orders dispatched from Bengaluru typically reach Karnataka destinations in 1 day, Tamil Nadu and Andhra Pradesh in 2–3 days via our courier partners.',
  },
  {
    q: 'Are the products genuine / authentic?',
    a: 'Yes. MXD sources directly from manufacturers. Every product is quality-checked before dispatch. We do not deal in counterfeit or grey-market goods.',
  },
  {
    q: 'Can I return or exchange products?',
    a: 'Defective products are eligible for replacement within 7 days of delivery. Raise a replacement request on WhatsApp with an unboxing video or photo evidence.',
  },
];

export default function HomeFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ maxWidth: 860, margin: '0 auto', padding: '60px 20px 0' }}>
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
          FAQ
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
          Frequently Asked Questions
        </h2>
        <p style={{ fontSize: 14, color: '#6B6B7D' }}>Everything you need to know about ordering from MXD.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FAQS.map((f, i) => (
          <div key={i} className="card" style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%',
                padding: '18px 20px',
                background: open === i ? '#FFF3E8' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', lineHeight: 1.4 }}>{f.q}</span>
              <span style={{ flexShrink: 0, color: '#F47920' }}>
                {open === i ? <Minus size={16} /> : <Plus size={16} />}
              </span>
            </button>
            {open === i && (
              <div
                style={{
                  padding: '0 20px 18px',
                  fontSize: 13,
                  color: '#6B6B7D',
                  lineHeight: 1.75,
                  borderTop: '1px solid #E8E4DE',
                  paddingTop: 14,
                }}
              >
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
