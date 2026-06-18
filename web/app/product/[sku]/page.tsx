import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import StockBadge from '@/components/ui/StockBadge';
import BrandChip from '@/components/ui/BrandChip';
import SkuLabel from '@/components/ui/SkuLabel';
import ProductActions from '@/components/features/product/ProductActions';
import BackButtonClient from '@/components/features/product/BackButton';
import ProductThumbnailsClient from '@/components/features/product/ProductThumbnails';
import type { Product } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function getProduct(sku: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API}/products/${sku}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const product = await getProduct(sku);
  if (!product) {
    return { title: 'Product Not Found | MXD Wholesale' };
  }
  return {
    title: `${product.name} — ${product.brand} | MXD Wholesale`,
    description: `Buy ${product.name} by ${product.brand} wholesale. SKU: ${sku}. MOQ: ${product.moq} units.`,
    openGraph: {
      title: product.name,
      images: product.images?.[0] ? [{ url: product.images[0] }] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = await getProduct(sku);

  if (!product) {
    notFound();
  }

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px' }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6B7D', marginBottom: 20 }}
        >
          <Link href="/" style={{ color: '#6B6B7D', textDecoration: 'none' }}>Home</Link>
          <ChevronRight size={12} />
          <Link href="/catalog" style={{ color: '#6B6B7D', textDecoration: 'none' }}>Catalog</Link>
          {product.category && (
            <>
              <ChevronRight size={12} />
              <Link
                href={`/catalog?category=${product.category.slug}`}
                style={{ color: '#6B6B7D', textDecoration: 'none' }}
              >
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight size={12} />
          <span style={{ color: '#1A1A2E', fontWeight: 600 }}>{product.name}</span>
        </nav>

        {/* Back */}
        <BackButton />

        {/* Main layout — product-layout CSS class handles responsive grid vs stack */}
        <div className="product-layout" style={{ gap: 40, alignItems: 'flex-start' }}>
          {/* Left: Images */}
          <div>
            {/* Main image */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
                background: '#EEF0FE',
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              {product.images?.[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  style={{ objectFit: 'cover' }}
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 64,
                    fontWeight: 900,
                    color: '#6366F1',
                  }}
                >
                  {product.brand.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images && product.images.length > 1 && (
              <ProductThumbnails images={product.images} productName={product.name} />
            )}
          </div>

          {/* Right: Info + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BrandChip brand={product.brand} />
              <StockBadge status={product.stockStatus} size="md" />
            </div>

            <h1 style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.2, color: '#1A1A2E' }}>
              {product.name}
            </h1>

            <SkuLabel sku={product.sku} />

            {/* Attributes grid */}
            {product.attributes && product.attributes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {product.attributes.map((attr, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#F8F6F2',
                      border: '1px solid #E8E4DE',
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                      {attr.name}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>
                      {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MOQ */}
            <div
              style={{
                background: '#FFF3E8',
                border: '1px solid #F47920',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#1A1A2E',
              }}
            >
              Minimum order quantity: <strong>{product.moq} units</strong>
            </div>

            {/* All interactive cart/wishlist/notify actions */}
            <ProductActions product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Thin wrappers to give semantic names at the call site ──────────────── */

function BackButton() {
  return <BackButtonClient />;
}

function ProductThumbnails({ images, productName }: { images: string[]; productName: string }) {
  return <ProductThumbnailsClient images={images} productName={productName} />;
}
