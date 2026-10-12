'use client';

/**
 * CategoryCardList — homepage grid of category cards linking into the filtered
 * catalog (/catalog?category=…). Fetches categories from the API.
 *
 * CRO note: switched from a single-row horizontal scroller to a dense
 * responsive grid with the product count always shown in bold/brand color —
 * matching the pattern used by same-niche competitors (Gaffarwala,
 * greatchoice.co.in), where a dense category grid with visible counts per
 * tile signals catalog depth immediately and lets a dealer self-navigate
 * without scrolling through a thin row first.
 */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { normalizeImageUrl } from '@/lib/config';
import { Package } from 'lucide-react';

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

// Admin-uploaded category icons are monochrome line art. They and the fallback
// for a category with no icon share one neutral tile so the grid reads as a set.
// (The fallback used to cycle through unrelated icons by position, which put a
// shield on Pen Drives and a phone on Earphones.)
const ICON_TILE: CSSProperties = {
  position: 'relative',
  width: 48,
  height: 48,
  background: '#F5F3F0',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  marginBottom: 10,
};

export default function CategoryCardList({ categories }: { categories: ApiCategory[] }) {
  if (categories.length === 0) {
    // Skeleton state
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: '16px 14px' }}>
            <div style={{ width: 48, height: 48, background: '#F0EDEA', borderRadius: 12, marginBottom: 10 }} />
            <div style={{ height: 12, background: '#F0EDEA', borderRadius: 4, marginBottom: 6, width: '80%' }} />
            <div style={{ height: 10, background: '#F5F3F0', borderRadius: 4, width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}
    >
      {categories.map((cat) => {
        return (
          <Link key={cat.id} href={`/catalog?category=${cat.slug}`} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ padding: '16px 14px', cursor: 'pointer', transition: 'border-color 0.15s', height: '100%' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#F47920')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#E8E4DE')}
            >
              <div style={ICON_TILE}>
                {cat.image ? (
                  <Image
                    src={normalizeImageUrl(cat.image)}
                    alt={cat.name}
                    fill
                    // multiply blends icons uploaded on a white background into
                    // the tile; transparent line art is unaffected.
                    style={{ objectFit: 'contain', padding: 7, boxSizing: 'border-box', mixBlendMode: 'multiply' }}
                    sizes="48px"
                  />
                ) : (
                  <Package size={22} color="#A8A39A" aria-hidden />
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{cat.name}</div>
              {/* Product count always shown, bold + brand color — the count
                  itself is the trust/depth signal, not just supplementary text. */}
              <div style={{ fontSize: 11, color: '#F47920', fontWeight: 700 }}>
                {cat.productCount ?? 0} product{(cat.productCount ?? 0) !== 1 ? 's' : ''}
              </div>
              {cat.description && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#A8A39A',
                    marginTop: 2,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {cat.description}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
