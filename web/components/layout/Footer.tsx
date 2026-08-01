'use client';

/**
 * Footer — site footer with company info, service-area, quick links, and contact
 * details. Shown on the public storefront pages.
 */
import Link from 'next/link';
import { MapPin, Clock, Package } from 'lucide-react';
import { whatsappLink } from '@/lib/config';

const CATEGORIES = [
  { name: 'Headphones', slug: 'headphones' },
  { name: 'Earphones', slug: 'earphones' },
  { name: 'Chargers', slug: 'chargers' },
  { name: 'Data Cables', slug: 'data-cables' },
  { name: 'Power Banks', slug: 'power-banks' },
  { name: 'Phone Cases', slug: 'phone-cases' },
];

export default function Footer() {
  return (
    <footer style={{ background: '#1A1A2E', padding: '48px 20px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 40,
            marginBottom: 40,
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginBottom: 12,
              }}
            >
              MXD<span style={{ color: '#F47920' }}>®</span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.7,
                marginBottom: 20,
              }}
            >
              B2B wholesale portal for mobile accessories. Serving registered dealers across South India.
            </p>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.61L0 24l6.545-1.376A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.785 9.785 0 0 1-5.032-1.392l-.36-.214-3.733.785.799-3.648-.235-.374A9.779 9.779 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
              </svg>
              WhatsApp Us
            </a>
          </div>

          {/* Quick Links */}
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 18,
              }}
            >
              Quick Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Browse Catalog', href: '/catalog' },
                { label: 'Become a Dealer', href: '/register' },
                { label: 'My Account', href: '/account' },
                { label: 'Cart', href: '/cart' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#F47920')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 18,
              }}
            >
              Categories
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/catalog?category=${c.slug}`}
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#F47920')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)')}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 18,
              }}
            >
              Contact
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { Icon: MapPin, text: 'Bengaluru, Karnataka, India' },
                { Icon: Clock, text: 'Mon–Sat · 9 AM – 7 PM' },
                { Icon: Package, text: 'Ships from: Bengaluru' },
              ].map(({ Icon, text }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={13} color="rgba(244,121,32,0.7)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{text}</span>
                </div>
              ))}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                  background: 'rgba(244,121,32,0.1)',
                  border: '1px solid rgba(244,121,32,0.2)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  width: 'fit-content',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F47920', letterSpacing: '0.04em' }}>
                  KA · TN · AP
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            © {new Date().getFullYear()} MXD® Wholesale. All rights reserved.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            For registered dealers only · B2B platform
          </div>
        </div>
      </div>
    </footer>
  );
}
