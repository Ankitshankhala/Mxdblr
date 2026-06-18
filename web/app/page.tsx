import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import ProductGrid from '@/components/products/ProductGrid';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryCardList from '@/components/home/CategoryCardList';
import BrandStrip from '@/components/home/BrandStrip';
import type { Product } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const MARQUEE_TEXT = [
  'New Arrivals: iPhone 16 Accessories Now Available',
  'Free Delivery on Orders above ₹5,000',
  'Service Area: Karnataka | Tamil Nadu | Andhra Pradesh',
  'WhatsApp Inquiries Processed within 2 Hours',
  'MOQ as Low as 5 Units on Select Products',
];

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
  children?: ApiCategory[];
}

async function getData() {
  try {
    const [categoriesRes, newArrivalRes, fallbackRes, brandsRes] = await Promise.allSettled([
      fetch(`${API}/categories`, { next: { revalidate: 60 } }).then((r) => r.json()),
      fetch(`${API}/products?isNewArrival=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
      fetch(`${API}/products?limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
      fetch(`${API}/products/brands`, { next: { revalidate: 300 } }).then((r) => r.json()),
    ]);

    const rawCategories =
      categoriesRes.status === 'fulfilled' ? (categoriesRes.value?.data ?? []) : [];

    // Show admin-flagged new arrivals; fall back to 8 newest products if none are flagged
    const flaggedProducts: Product[] =
      newArrivalRes.status === 'fulfilled' ? (newArrivalRes.value?.data ?? []) : [];
    const fallbackProducts: Product[] =
      fallbackRes.status === 'fulfilled' ? (fallbackRes.value?.data ?? []) : [];
    const products: Product[] = flaggedProducts.length ? flaggedProducts : fallbackProducts;

    const brands: string[] =
      brandsRes.status === 'fulfilled' ? (brandsRes.value?.data ?? ['MXD']) : ['MXD'];

    // Flatten category tree, take first 8
    const flatCategories: ApiCategory[] = [];
    function flatten(nodes: ApiCategory[]) {
      nodes.forEach((n) => {
        flatCategories.push(n);
        if (n.children?.length) flatten(n.children);
      });
    }
    flatten(rawCategories);

    return {
      categories: flatCategories.slice(0, 8),
      products,
      brands: brands.length ? brands : ['MXD'],
    };
  } catch {
    return { categories: [], products: [], brands: ['MXD'] };
  }
}

export default async function HomePage() {
  const { categories, products, brands } = await getData();

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      {/* Announcement Marquee */}
      <div
        style={{
          background: '#1A1A2E',
          color: '#F47920',
          padding: '7px 0',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="marquee-inner" style={{ display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
          {[...MARQUEE_TEXT, ...MARQUEE_TEXT].map((text, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 600, paddingRight: 60 }}>
              {text}
              <span style={{ marginLeft: 30, opacity: 0.4 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero Slider */}
      <HeroBanner />

      {/* Featured Categories */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: 20 }}>Browse by Category</h2>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All
          </Link>
        </div>
        {/* CategoryCardList is a client component to handle hover effects */}
        <CategoryCardList categories={categories} />
      </section>

      {/* New Arrivals */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>New Arrivals</h2>
            <p style={{ fontSize: 13, color: '#6B6B7D', marginTop: 2 }}>Latest additions to the catalog</p>
          </div>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All <ArrowRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
        <ProductGrid products={products} loading={false} columns={4} />
      </section>

      {/* Brand Logos Strip */}
      <section style={{ maxWidth: 1280, margin: '40px auto 0', padding: '0 20px' }}>
        <p style={{ fontSize: 11, color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
          Brands We Carry
        </p>
        <BrandStrip brands={brands} />
      </section>
    </div>
  );
}
