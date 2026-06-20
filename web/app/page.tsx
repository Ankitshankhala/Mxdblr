import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import Footer from '@/components/layout/Footer';
import ProductGrid from '@/components/products/ProductGrid';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryCardList from '@/components/home/CategoryCardList';
import BrandStrip from '@/components/home/BrandStrip';
import TrustStats from '@/components/home/TrustStats';
import DealerCTABanner from '@/components/home/DealerCTABanner';
import WhyChooseMXD from '@/components/home/WhyChooseMXD';
import HowItWorks from '@/components/home/HowItWorks';
import CoverageSection from '@/components/home/CoverageSection';
import Testimonials from '@/components/home/Testimonials';
import HomeFAQ from '@/components/home/HomeFAQ';
import type { Product } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Fallback shown only if the announcements API returns nothing
// (admin cleared all messages, or the API is unreachable).
const MARQUEE_FALLBACK = [
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
    const [categoriesRes, bestSellerRes, bestSellerFallbackRes, newArrivalRes, fallbackRes, brandsRes, announcementsRes] =
      await Promise.allSettled([
        fetch(`${API}/categories`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isBestSeller=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isNewArrival=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products/brands`, { next: { revalidate: 300 } }).then((r) => r.json()),
        fetch(`${API}/announcements`, { next: { revalidate: 30 } }).then((r) => r.json()),
      ]);

    const rawCategories =
      categoriesRes.status === 'fulfilled' ? (categoriesRes.value?.data ?? []) : [];

    const flaggedBestSellers: Product[] =
      bestSellerRes.status === 'fulfilled' ? (bestSellerRes.value?.data ?? []) : [];
    const bestSellerFallback: Product[] =
      bestSellerFallbackRes.status === 'fulfilled' ? (bestSellerFallbackRes.value?.data ?? []) : [];
    const bestSellers: Product[] = flaggedBestSellers.length ? flaggedBestSellers : bestSellerFallback;

    const flaggedNewArrivals: Product[] =
      newArrivalRes.status === 'fulfilled' ? (newArrivalRes.value?.data ?? []) : [];
    const newArrivalFallback: Product[] =
      fallbackRes.status === 'fulfilled' ? (fallbackRes.value?.data ?? []) : [];
    const newArrivals: Product[] = flaggedNewArrivals.length ? flaggedNewArrivals : newArrivalFallback;

    const brands: string[] =
      brandsRes.status === 'fulfilled' ? (brandsRes.value?.data ?? ['MXD']) : ['MXD'];

    const announcements: string[] =
      announcementsRes.status === 'fulfilled'
        ? (announcementsRes.value?.data ?? []).map((a: { text: string }) => a.text)
        : [];

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
      bestSellers,
      newArrivals,
      brands: brands.length ? brands : ['MXD'],
      announcements,
    };
  } catch {
    return { categories: [], bestSellers: [], newArrivals: [], brands: ['MXD'], announcements: [] };
  }
}

export default async function HomePage() {
  const { categories, bestSellers, newArrivals, brands, announcements } = await getData();
  const marqueeMessages = announcements.length ? announcements : MARQUEE_FALLBACK;

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
          {[...marqueeMessages, ...marqueeMessages].map((text, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 600, paddingRight: 60 }}>
              {text}
              <span style={{ marginLeft: 30, opacity: 0.4 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* 1. Hero Slider */}
      <HeroBanner />

      {/* 2. Trust Statistics */}
      <TrustStats />

      {/* 3. Browse by Category */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: 20 }}>Browse by Category</h2>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All
          </Link>
        </div>
        <CategoryCardList categories={categories} />
      </section>

      {/* 4. Best Sellers */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>Best Sellers</h2>
            <p style={{ fontSize: 13, color: '#6B6B7D', marginTop: 2 }}>Most popular products with our dealers</p>
          </div>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All <ArrowRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
        <ProductGrid products={bestSellers} loading={false} columns={4} />
      </section>

      {/* 5. New Arrivals */}
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
        <ProductGrid products={newArrivals} loading={false} columns={4} />
      </section>

      {/* 6. Become Dealer CTA Banner */}
      <DealerCTABanner />

      {/* 7. Shop By Brand */}
      <section style={{ maxWidth: 1280, margin: '0 auto 0', padding: '0 20px' }}>
        <p style={{ fontSize: 11, color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
          Brands We Carry
        </p>
        <BrandStrip brands={brands} />
      </section>

      {/* 8. Why Choose MXD */}
      <WhyChooseMXD />

      {/* 9. How It Works */}
      <HowItWorks />

      {/* 10. Coverage Map / Area */}
      <CoverageSection />

      {/* 11. Testimonials */}
      <Testimonials />

      {/* 12. FAQ */}
      <HomeFAQ />

      {/* Spacer before footer */}
      <div style={{ height: 60 }} />

      {/* 13. Footer */}
      <Footer />
    </div>
  );
}
