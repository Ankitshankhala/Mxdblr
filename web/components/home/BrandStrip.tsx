'use client';

import Link from 'next/link';

export default function BrandStrip({ brands }: { brands: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 32,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '16px 0',
        borderTop: '1px solid #E8E4DE',
        borderBottom: '1px solid #E8E4DE',
      }}
    >
      {brands.map((brand) => (
        <Link
          key={brand}
          href={`/catalog?brand=${brand}`}
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#6B6B7D',
            textDecoration: 'none',
            letterSpacing: '-0.02em',
            transition: 'color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#F47920')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = '#6B6B7D')}
        >
          {brand}
        </Link>
      ))}
    </div>
  );
}
