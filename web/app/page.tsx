/**
 * Home page (route: /). Server Component that composes the storefront landing:
 * hero banner, category cards, featured product grid, and the marketing sections
 * (trust stats, how-it-works, coverage, testimonials, FAQ, dealer CTA) plus the
 * shared Navbar/Footer/MobileBottomNav chrome. Interactive pieces are delegated
 * to client child components.
 */
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
import EventsActivities, { type EventItem } from '@/components/home/EventsActivities';
import HowItWorks from '@/components/home/HowItWorks';
import CoverageSection from '@/components/home/CoverageSection';
import Testimonials from '@/components/home/Testimonials';
import HomeFAQ from '@/components/home/HomeFAQ';
import AboutStory from '@/components/home/AboutStory';
import PromoCountdownBanner from '@/components/home/PromoCountdownBanner';
import type { Product } from '@/types';

// Server-side (SSR/ISR) fetches: prefer the internal Docker service URL when set
// (the browser-facing NEXT_PUBLIC_API_URL may be unreachable from inside the
// container, e.g. localhost:4000). Falls back to the public URL otherwise.
const API = process.env.INTERNAL_API_URL
  ? `${process.env.INTERNAL_API_URL.replace(/\/$/, '')}/api`
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');

// Fallback shown only if the announcements API returns nothing
// (admin cleared all messages, or the API is unreachable).
const MARQUEE_FALLBACK = [
  'New Arrivals: iPhone 16 Accessories Now Available',
  'Free Delivery on Orders above ₹5,000',
  'Service Area: Karnataka | Tamil Nadu | Andhra Pradesh',
  'Same-Day Dispatch on Orders Placed Before 3 PM',
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
    // `fallbackRes` (a plain latest-products list) is shared as the fallback for
    // BOTH best-sellers and new-arrivals when their flagged lists are empty —
    // previously this identical request was fired twice (audit #10).
    const [categoriesRes, bestSellerRes, newArrivalRes, fallbackRes, brandsRes, announcementsRes, eventsRes] =
      await Promise.allSettled([
        fetch(`${API}/categories`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isBestSeller=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isNewArrival=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products/brands`, { next: { revalidate: 300 } }).then((r) => r.json()),
        fetch(`${API}/announcements`, { next: { revalidate: 30 } }).then((r) => r.json()),
        fetch(`${API}/events?limit=12`, { next: { revalidate: 60 } }).then((r) => r.json()),
      ]);

    const rawCategories =
      categoriesRes.status === 'fulfilled' ? (categoriesRes.value?.data ?? []) : [];

    // Shared latest-products fallback, fetched once.
    const latestFallback: Product[] =
      fallbackRes.status === 'fulfilled' ? (fallbackRes.value?.data ?? []) : [];

    const flaggedBestSellers: Product[] =
      bestSellerRes.status === 'fulfilled' ? (bestSellerRes.value?.data ?? []) : [];
    const bestSellers: Product[] = flaggedBestSellers.length ? flaggedBestSellers : latestFallback;

    const flaggedNewArrivals: Product[] =
      newArrivalRes.status === 'fulfilled' ? (newArrivalRes.value?.data ?? []) : [];
    const newArrivals: Product[] = flaggedNewArrivals.length ? flaggedNewArrivals : latestFallback;

    const brands: string[] =
      brandsRes.status === 'fulfilled' ? (brandsRes.value?.data ?? ['MXD']) : ['MXD'];

    const announcements: string[] =
      announcementsRes.status === 'fulfilled'
        ? (announcementsRes.value?.data ?? []).map((a: { text: string }) => a.text)
        : [];

    const events: EventItem[] =
      eventsRes.status === 'fulfilled' ? (eventsRes.value?.data ?? []) : [];

    const flatCategories: ApiCategory[] = [];
    function flatten(nodes: ApiCategory[]) {
      nodes.forEach((n) => {
        flatCategories.push(n);
        if (n.children?.length) flatten(n.children);
      });
    }
    flatten(rawCategories);

    return {
      // Show more categories on the homepage grid (was 8) — competitor
      // benchmarking (Gaffarwala, greatchoice.co.in) showed dense category
      // grids with visible product counts signal catalog depth better than
      // a thin row of a few tiles.
      categories: flatCategories.slice(0, 12),
      bestSellers,
      newArrivals,
      brands: brands.length ? brands : ['MXD'],
      announcements,
      events,
    };
  } catch {
    return { categories: [], bestSellers: [], newArrivals: [], brands: ['MXD'], announcements: [], events: [] };
  }
}

export default async function HomePage() {
  const { categories, bestSellers, newArrivals, brands, announcements, events } = await getData();
  const marqueeMessages = announcements.length ? announcements : MARQUEE_FALLBACK;

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      {/* Announcement Marquee. tabIndex + aria-label make it a focusable, named
          region; hover/focus pauses the scroll (see .marquee-bar in globals.css).
          The row is duplicated for a seamless loop — the second copy is
          aria-hidden so screen readers read each message exactly once. */}
      <div
        className="marquee-bar"
        role="region"
        aria-label="Site announcements"
        tabIndex={0}
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
            <span
              key={i}
              aria-hidden={i >= marqueeMessages.length ? true : undefined}
              style={{ fontSize: 12, fontWeight: 600, paddingRight: 60 }}
            >
              {text}
              <span style={{ marginLeft: 30, opacity: 0.4 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/*
        Section order follows the CRO review's recommended sequence: orient
        the visitor (hero) -> make the pitch (why us) -> back it with proof
        (stats) -> establish it's a real business (about) -> explain the
        process + requirements upfront -> show the catalog -> third-party
        trust (brands) -> filter by service area -> social proof -> final
        conversion push -> objection handling (FAQ). Previously stats and
        product grids ran before the visitor had any reason established to
        care about them.
      */}

      {/* 1. Hero Slider */}
      <HeroBanner />

      {/* 2. Why Choose MXD — the actual value proposition, right after hero */}
      <WhyChooseMXD />

      {/* 3. Trust Statistics — now validates the pitch just made */}
      <TrustStats />

      {/* 4. About / Our Story — establishes this is a real operation */}
      <AboutStory />

      {/* 5. How It Works — sets GST/requirement expectations before the CTA */}
      <HowItWorks />

      {/* 6. Browse by Category */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: 20 }}>Browse by Category</h2>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All
          </Link>
        </div>
        <CategoryCardList categories={categories} />
      </section>

      {/* 6b. Promo countdown banner — urgency pattern from competitor
          benchmarking (Gaffarwala, greatchoice.co.in), placed right after
          category browsing and before the product grids it drives traffic to. */}
      <PromoCountdownBanner />

      {/* 7. Best Sellers */}
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

      {/* 8. New Arrivals */}
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

      {/* 9. Shop By Brand — third-party trust via known manufacturer logos */}
      <section style={{ maxWidth: 1280, margin: '0 auto 0', padding: '0 20px' }}>
        <p style={{ fontSize: 11, color: '#A8A39A', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
          Brands We Carry
        </p>
        <BrandStrip brands={brands} />
      </section>

      {/* 10. Events & Activities */}
      <EventsActivities events={events} />

      {/* 11. Coverage Map / Area — filters expectations by service area before final CTA */}
      <CoverageSection />

      {/* 12. Testimonials */}
      <Testimonials />

      {/* 13. Become Dealer CTA Banner — final conversion push */}
      <DealerCTABanner />

      {/* 14. FAQ — objection handling */}
      <HomeFAQ />

      {/* Spacer before footer */}
      <div style={{ height: 60 }} />

      {/* 15. Footer */}
      <Footer />
    </div>
  );
}
