"use client";

/**
 * HeroBanner — homepage hero carousel driven by the banners API (autoplay +
 * arrows, responsive: stacks on mobile). normalizeImg() rewrites legacy
 * localhost upload hosts to the configured API origin so banner images resolve
 * on phones (Cloudinary/remote URLs pass through). See production audit NEW-3.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

type BannerType = "SIMPLE" | "PRODUCT_PROMO" | "BRAND_PROMO";

interface Banner {
  id: string;
  bannerType: BannerType;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  image: string;
  mobileImage: string;
  bgColor: string;
  accentColor: string;
  logoImage: string;
  productImage1: string;
  productImage2: string;
  productImage3: string;
  overlayOpacity: number;
  textAlignment: string;
}

const FALLBACK_BANNERS: Banner[] = [
  {
    id: "f1",
    bannerType: "SIMPLE",
    title: "Wholesale Mobile Accessories. No Minimum Bulk Orders.",
    subtitle: "1,200+ genuine SKUs, MOQ as low as 5 units, same-day dispatch from Bengaluru — for registered dealers across Karnataka, Tamil Nadu & Andhra Pradesh.",
    ctaText: "Browse Catalog",
    ctaLink: "/catalog",
    image: "",
    mobileImage: "",
    bgColor: "#1A1A2E",
    accentColor: "#F47920",
    logoImage: "",
    productImage1: "",
    productImage2: "",
    productImage3: "",
    overlayOpacity: 0.35,
    textAlignment: "left",
  },
  {
    id: "f2",
    bannerType: "SIMPLE",
    title: "New Arrivals: iPhone 16 Accessories",
    subtitle: "Latest cases, chargers, and screen guards for iPhone 16 series. MOQ as low as 10 units.",
    ctaText: "Shop Now",
    ctaLink: "/catalog?category=cases-covers",
    image: "",
    mobileImage: "",
    bgColor: "#0F1F0F",
    accentColor: "#22c55e",
    logoImage: "",
    productImage1: "",
    productImage2: "",
    productImage3: "",
    overlayOpacity: 0.35,
    textAlignment: "left",
  },
  {
    id: "f3",
    bannerType: "SIMPLE",
    title: "GaN Chargers in Stock",
    subtitle: "Syska, Baseus & more. 33W to 65W. Wholesale pricing for registered dealers only.",
    ctaText: "View Chargers",
    ctaLink: "/catalog?category=chargers",
    image: "",
    mobileImage: "",
    bgColor: "#1A0F00",
    accentColor: "#F59E0B",
    logoImage: "",
    productImage1: "",
    productImage2: "",
    productImage3: "",
    overlayOpacity: 0.35,
    textAlignment: "left",
  },
];

const AUTO_PLAY_INTERVAL = 4500;
const MOBILE_BREAKPOINT = 768;

// API origin derived from NEXT_PUBLIC_API_URL (strip the trailing /api).
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

// Banner images are stored as absolute dev URLs (http://localhost:4000/uploads/...).
// "localhost" is unreachable from a phone on the LAN, so rewrite the /uploads host
// to the configured API origin. Cloudinary/remote URLs (no /uploads segment) pass
// through untouched, so this is safe in production.
function normalizeImg(url: string): string {
  if (!url) return url;
  if (/^https?:\/\/[^/]+\/uploads\//.test(url)) {
    return url.replace(/^https?:\/\/[^/]+(\/uploads\/)/, `${API_ORIGIN}$1`);
  }
  if (url.startsWith("/uploads/")) return `${API_ORIGIN}${url}`;
  return url;
}

// Resolve a CTA link into a safe href + whether it should open in a new tab.
// Empty/whitespace links fall back to /catalog (never render href="" which points
// at the current page). Absolute http(s) URLs are treated as external → new tab
// with rel="noopener". Everything else is an internal path.
function resolveCta(link: string): { href: string; external: boolean } {
  const trimmed = (link || "").trim();
  if (!trimmed) return { href: "/catalog", external: false };
  if (/^https?:\/\//i.test(trimmed)) return { href: trimmed, external: true };
  return { href: trimmed.startsWith("/") ? trimmed : `/${trimmed}`, external: false };
}

// SSR-safe viewport detector: defaults to desktop on the server + first client
// render (so hydration matches), then corrects on mount. 768px matches the
// (max-width: 768px) breakpoint used elsewhere in the app.
function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

function BannerContent({
  b,
  current,
  banners,
  isMobile,
}: {
  b: Banner;
  current: number;
  banners: Banner[];
  isMobile: boolean;
}) {
  const productImages = [b.productImage1, b.productImage2, b.productImage3].filter(Boolean).map(normalizeImg);
  const isProductPromo = b.bannerType === "PRODUCT_PROMO";
  const isBrandPromo = b.bannerType === "BRAND_PROMO";
  const hasRightPanel = (isProductPromo && productImages.length > 0) || (isBrandPromo && b.logoImage);
  // On mobile we always stack into a single centered column regardless of config.
  const centered = !isMobile && b.textAlignment === "center";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1280,
        margin: "0 auto",
        padding: isMobile ? "40px 20px 56px" : "56px 24px",
        width: "100%",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        gap: isMobile ? 28 : 40,
        justifyContent: centered ? "center" : "space-between",
      }}
    >
      {/* Text side */}
      <div
        style={{
          flex: isMobile ? "none" : 1,
          width: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? "100%" : hasRightPanel ? 560 : 640,
          textAlign: centered ? "center" : "left",
        }}
      >
        {/* Accent pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: `${b.accentColor}22`,
            color: b.accentColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "4px 12px",
            borderRadius: 999,
            marginBottom: 18,
            border: `1px solid ${b.accentColor}44`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.accentColor, display: "inline-block" }} />
          MXD® Wholesale
        </div>

        <h1
          style={{
            fontSize: "clamp(26px, 4.5vw, 52px)",
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.08,
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          {b.title.split(" ").map((word, wi) =>
            word.endsWith(".") || word.endsWith("!") ? (
              <span key={wi} style={{ color: b.accentColor }}>{word} </span>
            ) : (
              <span key={wi}>{word} </span>
            )
          )}
        </h1>

        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 15,
            lineHeight: 1.65,
            marginBottom: 32,
            maxWidth: isMobile ? "100%" : 480,
            marginLeft: centered ? "auto" : undefined,
            marginRight: centered ? "auto" : undefined,
          }}
        >
          {b.subtitle}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: centered ? "center" : "flex-start" }}>
          {(() => {
            const cta = resolveCta(b.ctaLink);
            return (
              <Link
                href={cta.href}
                {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: b.accentColor, color: "#fff",
                  fontWeight: 700, fontSize: 14, padding: "12px 24px",
                  borderRadius: 10, textDecoration: "none", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.88")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
              >
                {b.ctaText}
                <ArrowRight size={16} />
              </Link>
            );
          })()}
          <Link
            href="/register"
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "12px 20px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10, color: "rgba(255,255,255,0.75)",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.2)")}
          >
            Register as a Dealer
          </Link>
        </div>

        {/* Slide counter */}
        <div style={{ marginTop: 36, fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em" }}>
          {String(current + 1).padStart(2, "0")} / {String(banners.length).padStart(2, "0")}
        </div>
      </div>

      {/* Right panel — Product Promo */}
      {isProductPromo && productImages.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            width: isMobile ? "100%" : undefined,
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            flexWrap: isMobile ? "wrap" : "nowrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {productImages.map((img, i) => {
            const desktopSize = productImages.length === 1 ? 260 : productImages.length === 2 ? 200 : 160;
            const mobileSize = productImages.length === 1 ? 180 : productImages.length === 2 ? 132 : 104;
            const size = isMobile ? mobileSize : desktopSize;
            return (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={img}
                alt={`Product ${i + 1}`}
                style={{
                  width: size,
                  height: size,
                  objectFit: "contain",
                  filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
                  transition: "transform 0.3s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "translateY(-4px) scale(1.03)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "")}
              />
            );
          })}
        </div>
      )}

      {/* Right panel — Brand Promo */}
      {isBrandPromo && b.logoImage && (
        <div style={{ flexShrink: 0, width: isMobile ? "100%" : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={normalizeImg(b.logoImage)}
            alt="Brand logo"
            style={{
              maxWidth: isMobile ? 180 : 240,
              maxHeight: isMobile ? 140 : 200,
              objectFit: "contain",
              filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.3))",
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function HeroBanner() {
  const [banners, setBanners] = useState<Banner[]>(FALLBACK_BANNERS);
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const isMobile = useIsMobile();
  const minHeight = isMobile ? 340 : 420;

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/banners`)
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setBanners(d.data); })
      .catch(() => {});
  }, []);

  const goTo = useCallback((idx: number) => {
    setIsTransitioning((t) => {
      if (t) return t;
      setCurrent(idx);
      setTimeout(() => setIsTransitioning(false), 500);
      return true;
    });
  }, []);

  // Advance using the functional updater so this callback never depends on
  // `current` — the autoplay effect below can then own a single stable interval
  // instead of churning one per slide (previous timer-leak / double-advance bug).
  const count = banners.length;
  const next = useCallback(() => {
    setCurrent((c) => {
      const target = (c + 1) % count;
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 500);
      return target;
    });
  }, [count]);
  const prev = useCallback(() => goTo((current - 1 + count) % count), [current, count, goTo]);

  // Single autoplay interval. Runs unless paused (hover), there's only one
  // slide, or the user has requested reduced motion at the OS level (WCAG
  // 2.2.2/2.3.3) — auto-advancing slides is exactly the kind of motion that
  // setting is meant to suppress. Re-created only when pause state or slide
  // count changes — not on every transition — so there is exactly one active
  // timer at a time.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || count <= 1 || prefersReducedMotion) return;
    const id = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(id);
  }, [paused, count, next]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  const banner = banners[current];

  return (
    <section
      className="hero-ctrl"
      tabIndex={0}
      style={{ position: "relative", overflow: "hidden", minHeight }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional banners. Use the left and right arrow keys to change slides."
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { next(); }
        else if (e.key === "ArrowLeft") { prev(); }
      }}
    >
      <div style={{ position: "relative", width: "100%", minHeight }} aria-live="polite">
        {banners.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${banners.length}`}
            aria-hidden={i === current ? undefined : true}
            style={{
              // The CURRENT slide is relative so it sizes the container to its
              // own (possibly tall, stacked-on-mobile) content — others are
              // absolute for the crossfade. This prevents mobile content from
              // being clipped by the section's overflow: hidden.
              position: i === current ? "relative" : "absolute",
              inset: 0,
              background: b.bgColor,
              opacity: i === current ? 1 : 0,
              transition: "opacity 0.5s ease",
              pointerEvents: i === current ? "auto" : "none",
              minHeight,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Background image — prefer the device-specific mobile image when
                on a phone; fall back to the desktop image when mobileImage is
                empty so existing banners render unchanged. */}
            {(isMobile ? b.mobileImage || b.image : b.image) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={normalizeImg(isMobile ? b.mobileImage || b.image : b.image)}
                alt=""
                aria-hidden="true"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                }}
              />
            )}

            {/* Gradient overlay — darkens for text readability. On mobile the
                content is stacked, so use a top-to-bottom gradient instead of
                left-to-right. */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: (isMobile ? b.mobileImage || b.image : b.image)
                  ? isMobile
                    ? `linear-gradient(180deg, ${b.bgColor}cc 0%, ${b.bgColor}dd 60%, ${b.bgColor}f5 100%)`
                    : `linear-gradient(90deg, ${b.bgColor}f0 0%, ${b.bgColor}bb 45%, ${b.bgColor}44 75%, transparent 100%)`
                  : `linear-gradient(135deg, ${b.bgColor}ee 0%, ${b.bgColor}99 50%, transparent 100%)`,
              }}
            />

            {/* Decorative blurred circle */}
            <div
              style={{
                position: "absolute", right: -80, top: "50%",
                transform: "translateY(-50%)",
                width: isMobile ? 260 : 400, height: isMobile ? 260 : 400, borderRadius: "50%",
                background: b.accentColor, opacity: 0.06,
                filter: "blur(60px)", pointerEvents: "none",
              }}
            />

            <BannerContent b={b} current={i} banners={banners} isMobile={isMobile} />
          </div>
        ))}
      </div>

      {/* Focus-visible rings for carousel controls (inline styles can't express
          :focus-visible). Uses a bright ring that reads on any admin bgColor. */}
      <style>{`
        .hero-ctrl:focus-visible {
          outline: 3px solid #fff;
          outline-offset: 2px;
          box-shadow: 0 0 0 5px rgba(0,0,0,0.45);
        }
      `}</style>

      {/* Prev / Next arrows — hidden on mobile (dots + autoplay handle nav, and
          edge-anchored arrows would overlap the stacked content) */}
      {banners.length > 1 && !isMobile && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
            className="hero-ctrl"
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)")}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={next}
            aria-label="Next banner"
            className="hero-ctrl"
            style={{
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)")}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div
          style={{
            position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 7, zIndex: 10,
          }}
        >
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1} of ${banners.length}`}
              aria-current={i === current ? "true" : undefined}
              className="hero-ctrl"
              style={{
                width: i === current ? 24 : 7, height: 7,
                borderRadius: 999,
                background: i === current ? banner.accentColor : "rgba(255,255,255,0.3)",
                border: "none", cursor: "pointer", padding: 0,
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
