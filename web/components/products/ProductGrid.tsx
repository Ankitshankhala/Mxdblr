'use client';

import type { Product } from '@/types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  columns?: 2 | 3 | 4;
}

function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: '1/1', width: '100%' }} />
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 18, width: 60, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 14, width: '90%' }} />
        <div className="skeleton" style={{ height: 14, width: '60%' }} />
        <div className="skeleton" style={{ height: 10, width: 80 }} />
        <div className="skeleton" style={{ height: 36, width: '100%', marginTop: 8, borderRadius: 10 }} />
      </div>
    </div>
  );
}

export default function ProductGrid({ products, loading = false, columns = 3 }: ProductGridProps) {
  const colClass = columns === 2
    ? 'grid-cols-2'
    : columns === 4
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
    : 'grid-cols-2 md:grid-cols-3';

  if (loading) {
    return (
      <div className={`grid gap-4 ${colClass}`}>
        {Array.from({ length: columns === 4 ? 8 : 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#6B6B7D',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
        <p style={{ fontWeight: 600, fontSize: 16 }}>No products found</p>
        <p style={{ fontSize: 14, marginTop: 4 }}>Try adjusting your filters or search term</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
