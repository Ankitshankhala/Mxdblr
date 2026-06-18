"use client";

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
    title: "Quality for Everyone.",
    subtitle: "The wholesale mobile accessories portal for verified dealers across Karnataka, Tamil Nadu & Andhra Pradesh.",
    ctaText: "Browse Catalog",
    ctaLink: "/catalog",
    image: "",
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

function BannerContent({ b, current, banners }: { b: Banner; current: number; banners: Banner[] }) {
  const productImages = [b.productImage1, b.productImage2, b.productImage3].filter(Boolean);
  const isProductPromo = b.bannerType === "PRODUCT_PROMO";
  const isBrandPromo = b.bannerType === "BRAND_PROMO";
  const hasRightPanel = (isProductPromo && productImages.length > 0) || (isBrandPromo && b.logoImage);

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1280,
        margin: "0 auto",
        padding: "56px 24px",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 40,
        justifyContent: b.textAlignment === "center" ? "center" : "space-between",
      }}
    >
      {/* Text side */}
      <div style={{ flex: 1, maxWidth: hasRightPanel ? 560 : 640, textAlign: b.textAlignment === "center" ? "center" : "left" }}>
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

        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, lineHeight: 1.65, marginBottom: 32, maxWidth: 480 }}>
          {b.subtitle}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: b.textAlignment === "center" ? "center" : "flex-start" }}>
          <Link
            href={b.ctaLink}
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
            Become a Dealer
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
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {productImages.map((img, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={img}
              alt={`Product ${i + 1}`}
              style={{
                width: productImages.length === 1 ? 260 : productImages.length === 2 ? 200 : 160,
                height: productImages.length === 1 ? 260 : productImages.length === 2 ? 200 : 160,
                objectFit: "contain",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
                transition: "transform 0.3s ease",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "translateY(-4px) scale(1.03)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "")}
            />
          ))}
        </div>
      )}

      {/* Right panel — Brand Promo */}
      {isBrandPromo && b.logoImage && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.logoImage}
            alt="Brand logo"
            style={{
              maxWidth: 240,
              maxHeight: 200,
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/banners`)
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setBanners(d.data); })
      .catch(() => {});
  }, []);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(idx);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const next = useCallback(() => goTo((current + 1) % banners.length), [current, banners.length, goTo]);
  const prev = useCallback(() => goTo((current - 1 + banners.length) % banners.length), [current, banners.length, goTo]);

  useEffect(() => {
    timerRef.current = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next]);

  const pause = () => { if (timerRef.current) clearInterval(timerRef.current); };
  const resume = () => { timerRef.current = setInterval(next, AUTO_PLAY_INTERVAL); };

  const banner = banners[current];

  return (
    <section
      style={{ position: "relative", overflow: "hidden", minHeight: 420 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div style={{ position: "relative", width: "100%", minHeight: 420 }}>
        {banners.map((b, i) => (
          <div
            key={b.id}
            style={{
              position: i === 0 ? "relative" : "absolute",
              inset: 0,
              background: b.bgColor,
              opacity: i === current ? 1 : 0,
              transition: "opacity 0.5s ease",
              pointerEvents: i === current ? "auto" : "none",
              minHeight: 420,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Background image */}
            {b.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={b.image}
                alt={b.title}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                }}
              />
            )}

            {/* Gradient overlay — darkens left side for text readability */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: b.image
                  ? `linear-gradient(90deg, ${b.bgColor}f0 0%, ${b.bgColor}bb 45%, ${b.bgColor}44 75%, transparent 100%)`
                  : `linear-gradient(135deg, ${b.bgColor}ee 0%, ${b.bgColor}99 50%, transparent 100%)`,
              }}
            />

            {/* Decorative blurred circle */}
            <div
              style={{
                position: "absolute", right: -80, top: "50%",
                transform: "translateY(-50%)",
                width: 400, height: 400, borderRadius: "50%",
                background: b.accentColor, opacity: 0.06,
                filter: "blur(60px)", pointerEvents: "none",
              }}
            />

            <BannerContent b={b} current={i} banners={banners} />
          </div>
        ))}
      </div>

      {/* Prev / Next arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
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
              aria-label={`Go to slide ${i + 1}`}
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
