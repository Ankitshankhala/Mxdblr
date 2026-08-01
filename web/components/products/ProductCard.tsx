'use client';

/**
 * ProductCard — catalog/home product tile: image gallery (autoplay + swipe/arrows/
 * dots), brand/SKU/MOQ, stock badge, and add-to-cart or notify-me CTA. No price
 * (B2B inquiry model). Product images stored as absolute localhost upload URLs are
 * rewritten to the configured API origin via normalizeImg() so they resolve on
 * phones/LAN devices (localhost = the device itself). Cloudinary/remote URLs pass
 * through untouched. Mirrors HeroBanner's normalizeImg (see production audit NEW-3).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import BrandChip from '@/components/ui/BrandChip';
import SkuLabel from '@/components/ui/SkuLabel';
import StockBadge from '@/components/ui/StockBadge';
import FeatureIcons from '@/components/products/FeatureIcons';
import type { Product } from '@/types';
import { cartApi } from '@/lib/api';
import { normalizeImageUrl } from '@/lib/config';

const SLIDE_INTERVAL = 3000;
// How long autoplay stays paused after a manual interaction (swipe / arrow / dot).
const RESUME_DELAY = 6000;
// Minimum horizontal travel (px) to count a touch as a swipe rather than a tap.
const SWIPE_THRESHOLD = 40;

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [addingToCart, setAddingToCart] = useState(false);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Track image URLs that 404 at runtime so we can drop them and show the
  // brand-initial fallback box instead of the browser's broken-image glyph +
  // alt text inside the card frame (some products have stale/missing uploads).
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allImages = product.images?.length ? product.images.map(normalizeImageUrl) : [];
  const images = allImages.filter((src) => !failedSrcs.has(src));
  const isOutOfStock = product.stockStatus === 'OUT_OF_STOCK';
  const hasMultiple = images.length > 1;

  // Autoplay: a single interval driven by `paused`. Runs unless paused or single image.
  useEffect(() => {
    if (paused || !hasMultiple) return;
    const id = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % images.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [paused, hasMultiple, images.length]);

  // Clear any pending resume timer on unmount.
  useEffect(() => () => { if (resumeRef.current) clearTimeout(resumeRef.current); }, []);

  // Pause autoplay, then resume after a delay (used by every manual interaction).
  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setPaused(false), RESUME_DELAY);
  }, []);

  const nudge = useCallback((dir: number) => {
    if (!hasMultiple) return;
    setCurrentIdx((i) => {
      const len = images.length;
      return ((i + dir) % len + len) % len;
    });
    pauseTemporarily();
  }, [hasMultiple, images.length, pauseTemporarily]);

  const goToIdx = useCallback((idx: number) => {
    setCurrentIdx(idx);
    pauseTemporarily();
  }, [pauseTemporarily]);

  // Hover (desktop): hover is authoritative over the timed resume.
  const onEnter = useCallback(() => {
    if (resumeRef.current) clearTimeout(resumeRef.current);
    setHovered(true);
    setPaused(true);
  }, []);
  const onLeave = useCallback(() => {
    if (resumeRef.current) clearTimeout(resumeRef.current);
    setHovered(false);
    setPaused(false);
  }, []);

  // Touch swipe (mobile). Distinguish a horizontal swipe from a vertical scroll or a tap.
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const didSwipe = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    didSwipe.current = false;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (hasMultiple && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      didSwipe.current = true;
      nudge(dx < 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };
  // A swipe also fires a click on the <Link>; suppress that so swiping doesn't navigate.
  const onLinkClick = (e: React.MouseEvent) => {
    if (didSwipe.current) {
      e.preventDefault();
      didSwipe.current = false;
    }
  };

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

  const arrowBtnStyle: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    zIndex: 3, width: 28, height: 28, borderRadius: '50%',
    background: 'rgba(26,26,46,0.45)', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0,
  };

  return (
    <motion.div
      className="card overflow-hidden flex flex-col"
      style={{ transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s' }}
      whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(26,26,46,0.12)', borderColor: '#1A1A2E' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* ── Image gallery ──────────────────────────────────────────────────────── */}
      <Link
        href={`/product/${product.sku}`}
        className="block"
        style={{ position: 'relative', background: '#F5F3EF', aspectRatio: '1 / 1', overflow: 'hidden', flexShrink: 0, touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onLinkClick}
      >
        {images.length > 0 ? (
          images.map((src, i) => (
            <Image
              key={i}
              src={src}
              // Only the first image carries the descriptive alt (accessibility);
              // the rest are empty so a broken/404 image renders as blank space
              // instead of dumping raw alt text ("<name> view 2") over the badges
              // inside the image frame. The product name is always shown in the
              // card body below, so no information is lost.
              alt={i === 0 ? product.name : ''}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              onError={() => setFailedSrcs((prev) => new Set(prev).add(src))}
              style={{
                objectFit: 'contain',
                padding: '12px',
                opacity: i === (currentIdx % images.length) ? 1 : 0,
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

        {/* Top overlay bar — category chip (left) + stock badge (right) laid out
            in a single flex row so they can never overlap. The chip flexes and
            truncates with an ellipsis when the category name is long (e.g.
            "STANDS & HOLDERS" on a ~150px-wide mobile card); the stock badge is
            fixed-width and always fully visible. gap + min-width:0 let the chip
            shrink instead of pushing the badge off-card. */}
        <div
          style={{
            position: 'absolute', top: 8, left: 8, right: 8, zIndex: 2,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 8, pointerEvents: 'none',
          }}
        >
          {product.category?.name ? (
            <span style={{ minWidth: 0, flexShrink: 1, background: '#1A1A2E', color: '#fff', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product.category.name.toUpperCase()}
            </span>
          ) : (
            <span />
          )}
          <span style={{ flexShrink: 0 }}>
            <StockBadge status={product.stockStatus} size="sm" />
          </span>
        </div>

        {/* Prev / Next arrows — desktop hover (mobile uses swipe) */}
        {hasMultiple && hovered && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); nudge(-1); }}
              style={{ ...arrowBtnStyle, left: 6 }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); nudge(1); }}
              style={{ ...arrowBtnStyle, right: 6 }}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Dot navigation — bottom center */}
        {hasMultiple && (
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View image ${i + 1}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToIdx(i); }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
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

        {/* Key features — up to 4 highlighted 48px badges (icon + label) + overflow badge */}
        {product.features && product.features.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <FeatureIcons features={product.features} max={4} />
          </div>
        )}

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
