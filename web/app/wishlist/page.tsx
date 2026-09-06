'use client';

/**
 * Wishlist page (route: /wishlist). Renders the dealer's saved products (managed
 * by the useWishlist hook / localStorage) with quick add-to-cart. Dealer-facing.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ArrowRight, Trash2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import BrandChip from '@/components/ui/BrandChip';
import StockBadge from '@/components/ui/StockBadge';
import SkuLabel from '@/components/ui/SkuLabel';
import { useWishlist } from '@/hooks/useWishlist';
import type { Product } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function WishlistPage() {
  const { wishlistIds, toggle } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (wishlistIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    Promise.all(
      wishlistIds.map((id) =>
        fetch(`${API}/products/${id}`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => json?.data ?? null)
          .catch(() => null)
      )
    )
      .then((results) => setProducts(results.filter((p): p is Product => p !== null)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [wishlistIds]);

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 22, color: '#1F1813', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Heart size={22} color="#F47920" fill="#F47920" />
              Wishlist
            </h1>
            {!loading && (
              <p style={{ fontSize: 13, color: '#6E6257', marginTop: 4 }}>
                {products.length} saved {products.length === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {Array.from({ length: Math.max(wishlistIds.length, 3) }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 280 }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: '#DC2626', fontWeight: 600, marginBottom: 16 }}>
              Failed to load wishlist items.
            </p>
            <button
              type="button"
              className="btn-orange"
              style={{ padding: '10px 20px', fontSize: 13 }}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#FFF3E8', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 24px', color: '#F47920',
            }}>
              <Heart size={32} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 20, color: '#1F1813', marginBottom: 10 }}>
              Your wishlist is empty
            </h2>
            <p style={{ fontSize: 14, color: '#6E6257', lineHeight: 1.6, marginBottom: 32 }}>
              Save products you love by tapping the heart icon on any product page.
            </p>
            <Link
              href="/catalog"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#F47920', color: '#fff', fontWeight: 700,
                padding: '12px 24px', borderRadius: 10, textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Browse Catalog <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Populated state */}
        {!loading && !error && products.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {products.map((product) => (
              <div
                key={product.id}
                className="card"
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              >
                {/* Product image */}
                <Link href={`/product/${product.sku}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1/1',
                      background: '#EEF0FE',
                      overflow: 'hidden',
                    }}
                  >
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 36, fontWeight: 900, color: '#6366F1',
                      }}>
                        {product.brand.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product info */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <BrandChip brand={product.brand} />
                    <StockBadge status={product.stockStatus} size="sm" />
                  </div>

                  <Link
                    href={`/product/${product.sku}`}
                    style={{ textDecoration: 'none', color: '#1F1813', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}
                  >
                    {product.name}
                  </Link>

                  <SkuLabel sku={product.sku} />

                  <div style={{ fontSize: 12, color: '#6E6257', marginTop: 2 }}>
                    MOQ: <strong>{product.moq} units</strong>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Link
                      href={`/product/${product.sku}`}
                      className="btn-orange"
                      style={{ flex: 1, padding: '8px 12px', fontSize: 12, textDecoration: 'none', justifyContent: 'center' }}
                    >
                      View Product
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggle(product.id)}
                      className="btn-ghost"
                      style={{ padding: '8px 10px', fontSize: 12 }}
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 size={14} color="#DC2626" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
