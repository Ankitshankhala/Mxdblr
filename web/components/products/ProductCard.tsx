'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Bell } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import BrandChip from '@/components/ui/BrandChip';
import SkuLabel from '@/components/ui/SkuLabel';
import StockBadge from '@/components/ui/StockBadge';
import type { Product } from '@/types';
import { cartApi } from '@/lib/api';

const SLIDE_INTERVAL = 3000;

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [addingToCart, setAddingToCart] = useState(false);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const images = product.images?.length ? product.images : [];
  const isOutOfStock = product.stockStatus === 'OUT_OF_STOCK';

  const startSlide = useCallback(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % images.length);
    }, SLIDE_INTERVAL);
  }, [images.length]);

  const stopSlide = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startSlide();
    return stopSlide;
  }, [startSlide, stopSlide]);

  function goTo(i: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    stopSlide();
    setCurrentIdx(i);
    // resume after a pause
    setTimeout(startSlide, SLIDE_INTERVAL);
  }

  async function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('mxd_token') : null;
    if (!token) { window.location.href = '/auth'; return; }
    setAddingToCart(true);
    setCartError(null);
    try {
      await cartApi.addOrUpdate(product.id, product.moq);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add';
      setCartError(msg);
      setTimeout(() => setCartError(null), 3000);
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <motion.div
      className="card overflow-hidden flex flex-col"
      style={{ transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s' }}
      whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(26,26,46,0.12)', borderColor: '#1A1A2E' }}
      onMouseEnter={stopSlide}
      onMouseLeave={startSlide}
    >
      {/* ── Image gallery ──────────────────────────────────────────────────────── */}
      <Link
        href={`/product/${product.sku}`}
        className="block"
        style={{ position: 'relative', background: '#F5F3EF', aspectRatio: '1 / 1', overflow: 'hidden', flexShrink: 0 }}
      >
        {images.length > 0 ? (
          images.map((src, i) => (
            <Image
              key={i}
              src={src}
              alt={`${product.name} view ${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              style={{
                objectFit: 'contain',
                padding: '12px',
                opacity: i === currentIdx ? 1 : 0,
                transition: 'opacity 0.5s ease',
                pointerEvents: 'none',
              }}
            />
          ))
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF0FE', color: '#6366F1', fontWeight: 800, fontSize: 28, letterSpacing: 1 }}>
            {product.brand.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Category chip — top left */}
        {product.category?.name && (
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2, background: '#1A1A2E', color: '#fff', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            {product.category.name.toUpperCase()}
          </div>
        )}

        {/* Stock badge — top right */}
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <StockBadge status={product.stockStatus} size="sm" />
        </div>

        {/* Dot navigation — bottom center */}
        {images.length > 1 && (
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
            {images.map((_, i) => (
              <div
                key={i}
                onClick={(e) => goTo(i, e)}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === currentIdx ? '#F47920' : 'rgba(0,0,0,0.22)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}
      </Link>

      {/* ── Card body ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <BrandChip brand={product.brand} />

        <Link
          href={`/product/${product.sku}`}
          style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textDecoration: 'none' }}
        >
          {product.name}
        </Link>

        <SkuLabel sku={product.sku} />

        <div style={{ fontSize: 12, color: '#6B6B7D', marginTop: 2 }}>
          MOQ: <strong style={{ color: '#1A1A2E' }}>{product.moq} pcs</strong>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          {cartError && <p style={{ fontSize: 11, color: '#DC2626', marginBottom: 6 }}>{cartError}</p>}
          {isOutOfStock ? (
            <Link
              href={`/product/${product.sku}#notify`}
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', padding: '9px 12px', fontSize: 13 }}
            >
              <Bell size={14} />
              Notify Me
            </Link>
          ) : (
            <button
              type="button"
              className="btn-orange"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
              onClick={handleAddToCart}
              disabled={addingToCart}
            >
              <ShoppingBag size={14} />
              {added ? 'Added!' : addingToCart ? 'Adding...' : '+ Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
