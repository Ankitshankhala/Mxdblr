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
// import BrandStrip from '@/components/home/BrandStrip'; // section removed 2026-08-12 — see section-order comment below
import TrustStats from '@/components/home/TrustStats';
import DealerCTABanner from '@/components/home/DealerCTABanner';
import WhyChooseMXD from '@/components/home/WhyChooseMXD';
import EventsActivities, { type EventItem } from '@/components/home/EventsActivities';
import HowItWorks from '@/components/home/HowItWorks';
import CoverageSection from '@/components/home/CoverageSection';
import Testimonials from '@/components/home/Testimonials';
import HomeFAQ from '@/components/home/HomeFAQ';
// import AboutStory from '@/components/home/AboutStory'; // re-enable with the <AboutStory /> render below
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
    // The /products/brands fetch was dropped 2026-08-12 along with the
    // BrandStrip section that was its only consumer.
    const [categoriesRes, bestSellerRes, newArrivalRes, fallbackRes, announcementsRes, eventsRes] =
      await Promise.allSettled([
        fetch(`${API}/categories`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isBestSeller=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?isNewArrival=true&limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
        fetch(`${API}/products?limit=8&sort=newest`, { next: { revalidate: 60 } }).then((r) => r.json()),
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
      announcements,
      events,
    };
  } catch {
    return { categories: [], bestSellers: [], newArrivals: [], announcements: [], events: [] };
  }
}

export default async function HomePage() {
  const { categories, bestSellers, newArrivals, announcements, events } = await getData();
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
          background: '#1F1813',
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
        SECTION ORDER — revised 2026-08-12. This supersedes the earlier CRO
        sequence (hero -> why -> stats -> about -> process -> catalog -> ...);
        do not restore that order without reading the reasoning below.

        The page is now structured around the order a wholesale buyer actually
        asks questions, in four acts:

          QUALIFY   hero -> category map -> coverage
          PERSUADE  why us -> stats -> events
          GOODS     promo -> best sellers -> new arrivals
          CONVERT   how it works -> dealer CTA -> FAQ

        Two deliberate changes from the CRO order:

        1. The CATEGORY MAP moves up to position 2. A dealer arriving from a
           search already knows what they want to buy, so their first question
           is range, and they leave if they cannot see their categories. The
           category grid answers that in one screen (12 categories with live
           counts). Note this does NOT contradict the CRO review's actual
           finding, which was that PRODUCT GRIDS should not lead — those stay
           low, at 8 and 9. Category map = range proof; grids = browsing depth.

        2. COVERAGE moves up to position 3, from 11. Registration is
           geo-restricted server-side (api/src/routes/auth.ts — out-of-state
           applicants get a 403), so a dealer outside Karnataka / Tamil Nadu /
           Andhra Pradesh was previously scrolling the whole page and filling
           the form before being turned away. Stating the service area early
           costs nothing: those registrations could never convert.

        Sections currently not rendered:
          - AboutStory   — placeholder only; slots in at 6 beside Events.
          - Testimonials — self-hides while its quotes are placeholders
                           (see Testimonials.tsx); reappears at 6 automatically
                           once real dealer quotes are added.
          - BrandStrip   — removed 2026-08-12. It rendered "ALL · MXD" (the
                           house brand plus a data-entry error), which undercut
                           the page in a third-party-trust slot. Component kept;
                           it earns a place back if repurposed to show
                           compatible handset brands.
      */}

      {/* ── ACT 1 · QUALIFY ─────────────────────────────────────────────── */}

      {/* 1. Hero Slider */}
      <HeroBanner />

      {/* 2. Browse by Category — range proof; the first question a wholesale
             buyer asks is "do you stock what I sell?" */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 800, fontSize: 20 }}>Browse by Category</h2>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All
          </Link>
        </div>
        <CategoryCardList categories={categories} />
      </section>

      {/* 3. Coverage Map / Area — hard qualifier. Registration is
             geo-restricted server-side, so state the service area before the
             visitor invests any time. */}
      <CoverageSection />

      {/* ── ACT 2 · PERSUADE ────────────────────────────────────────────── */}

      {/* 4. Why Choose MXD — the value proposition (MOQ from 5, same-day
             dispatch), now anchored to a catalog the visitor has just seen */}
      <WhyChooseMXD />

      {/* 5. Trust Statistics — backs the pitch just made */}
      <TrustStats />

      {/* 6. Events & Activities — evidence of an operating business.
             AboutStory and Testimonials both belong in this slot; see the
             header comment for why neither renders yet. */}
      <EventsActivities events={events} />
      {/* <AboutStory /> */}
      <Testimonials />

      {/* ── ACT 3 · SHOW THE GOODS ──────────────────────────────────────── */}

      {/* 7. Promo countdown banner — urgency pattern from competitor
          benchmarking (Gaffarwala, greatchoice.co.in). Must stay directly
          above the product grids it drives traffic into. */}
      <PromoCountdownBanner />

      {/* 8. Best Sellers */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>Best Sellers</h2>
            <p style={{ fontSize: 13, color: '#6E6257', marginTop: 2 }}>Most popular products with our dealers</p>
          </div>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All <ArrowRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
        <ProductGrid products={bestSellers} loading={false} columns={4} />
      </section>

      {/* 9. New Arrivals */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 20 }}>New Arrivals</h2>
            <p style={{ fontSize: 13, color: '#6E6257', marginTop: 2 }}>Latest additions to the catalog</p>
          </div>
          <Link href="/catalog" style={{ fontSize: 13, color: '#F47920', textDecoration: 'none', fontWeight: 600 }}>
            View All <ArrowRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
        <ProductGrid products={newArrivals} loading={false} columns={4} />
      </section>

      {/* ── ACT 4 · CONVERT ─────────────────────────────────────────────── */}

      {/* 10. How It Works — sets GST/requirement expectations immediately
              before the ask, so the CTA meets an informed visitor */}
      <HowItWorks />

      {/* 11. Become Dealer CTA Banner — the conversion push */}
      <DealerCTABanner />

      {/* 12. FAQ — objection handling, last */}
      <HomeFAQ />

      {/* Spacer before footer */}
      <div style={{ height: 60 }} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
