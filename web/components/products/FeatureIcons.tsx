'use client';

/**
 * FeatureIcons — "Highlighted Key Features" strip for a product card (brief Option C).
 * Each badge is a 56px feature asset, captioned with its short name only when the
 * asset cannot speak for itself (see LABEL RULE below), so a customer reads product
 * capabilities at a glance instead of decoding tiny icons. Shows up to `max`
 * (default 4) badges; overflow collapses into a refined "+N more" badge whose
 * tooltip lists the remaining names.
 *
 * IMPORTANT — no wrapping frame around the asset. The seeded placeholder SVGs (and
 * most real brand logos) already carry their own rounded border/background, so an
 * extra bordered container renders a box-in-a-box and makes the logo look smaller.
 *
 * LABEL RULE — the caption is shown only when the badge is NOT displaying a real
 * uploaded logo. Real brand assets (VOOC, Dash Charge, Warp Charge…) are wordmarks:
 * the name is already drawn inside the artwork, so a caption underneath duplicates
 * it and — because long names were truncated at 16 chars — rendered as
 * "Qualcomm …", which reads as broken. When the badge falls back to a
 * /public/product-features/<slug>.svg placeholder (still the case for most
 * features until real artwork is supplied), the caption is kept, because the
 * placeholder box alone identifies nothing. The name is ALWAYS exposed via
 * title/aria-label/alt, so hiding it visually costs nothing for screen readers,
 * hover tooltips or SEO.
 *
 * Asset resolves from feature.image / feature.logo (uploaded URL,
 * /public/product-features/<slug>.svg, or inline SVG data-URI). Image takes
 * priority over icon unless displayMode is explicitly ICON; a broken/empty asset
 * falls back to the other, then to a monogram so the slot never renders blank.
 * A broken uploaded image falls back to the placeholder AND brings its caption
 * back, so the slot never ends up both unlabelled and unrecognisable.
 * Read-only, presentational.
 */
import { useState } from 'react';
import type { ProductFeature } from '@/types';
import { normalizeImageUrl } from '@/lib/config';

interface FeatureIconsProps {
  features: ProductFeature[];
  max?: number;
  /** px size of the feature asset (default 56) */
  size?: number;
}

function monogram(f: ProductFeature): string {
  // Short label from the slug (e.g. quick-charge → QC, usb-pd → PD).
  const parts = f.slug.split('-');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return f.slug.slice(0, 2).toUpperCase();
}

/** Truncate long feature names so the badge label stays one short line. */
function shortName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

function FeatureBadge({ feature, size }: { feature: ProductFeature; size: number }) {
  const [broken, setBroken] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Normalize both assets so localhost dev-upload URLs resolve on phones/LAN
  // devices. Without this, an uploaded feature image stored as
  // http://localhost:4000/uploads/... 404s on mobile (localhost = the phone),
  // fires onError, and the badge silently falls back to the icon — i.e. "mobile
  // shows only the icon." Mirrors ProductCard's gallery normalizeImageUrl().
  const image = feature.image ? normalizeImageUrl(feature.image) : feature.image;
  const logo = feature.logo ? normalizeImageUrl(feature.logo) : feature.logo;

  const preferImage = feature.displayMode !== 'ICON';
  const primary = preferImage ? image || logo : logo || image;
  const fallback = preferImage ? logo : image;
  const src = !broken ? primary : fallback;
  const showImg = Boolean(src);

  // A real uploaded logo is a wordmark — it carries its own name, so the caption
  // is suppressed. Anything else (a /public placeholder, or an uploaded image
  // that failed to load and fell back) keeps its caption. See file header.
  const showsRealLogo = showImg && Boolean(image) && src === image;

  // Brand wordmarks are wide (the seeded set is 363×199, ~1.82:1). Boxing them in
  // a square slot with object-fit:contain caps them at the slot WIDTH, so a 56px
  // square rendered them 56×31 and threw away 45% of the box as blank space.
  // Real logos therefore get a fixed HEIGHT and free width (capped), which lets a
  // wide mark render ~73×40 — nearly double the pixel area — while a square mark
  // still comes out square. Placeholders stay in the square captioned slot.
  const logoHeight = Math.round(size * 0.72);
  const logoMaxWidth = Math.round(size * 1.9);

  return (
    <span
      role="listitem"
      title={feature.name}
      aria-label={feature.name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        width: showsRealLogo ? 'auto' : size + 20,
        maxWidth: showsRealLogo ? logoMaxWidth : undefined,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: showsRealLogo ? 'auto' : size,
          height: showsRealLogo ? logoHeight : size,
          maxWidth: showsRealLogo ? logoMaxWidth : undefined,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'transform 0.15s ease',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        {showImg ? (
          // Plain <img>: assets are static SVGs in /public or Cloudinary URLs;
          // next/image would need remote-pattern config and adds no value here.
          // Intrinsic size is 2× so raster/photo assets stay sharp on high-DPR
          // screens. No padding/border — the asset fills the slot (see file header).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={feature.name}
            width={size * 2}
            height={size * 2}
            loading="lazy"
            decoding="async"
            style={
              showsRealLogo
                ? // Height-locked, width free: a wide wordmark scales to its own
                  // aspect ratio instead of being capped by a square slot.
                  { objectFit: 'contain', height: '100%', width: 'auto', maxWidth: '100%' }
                : { objectFit: 'contain', width: '100%', height: '100%' }
            }
            onError={() => setBroken(true)}
          />
        ) : (
          <span
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 12,
              background: '#EEF0FE',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: '#4A4AE0',
              letterSpacing: 0.3,
            }}
          >
            {monogram(feature)}
          </span>
        )}
      </span>

      {!showsRealLogo && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#4A4A5A',
            lineHeight: 1.15,
            textAlign: 'center',
            maxWidth: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {shortName(feature.name)}
        </span>
      )}
    </span>
  );
}

export default function FeatureIcons({ features, max = 4, size = 56 }: FeatureIconsProps) {
  if (!features || features.length === 0) return null;

  const shown = features.slice(0, max);
  const overflow = features.slice(max);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        // Single scrollable row, never wrap. A product card is ~130px wide on a
        // 375px phone, so wrapping put ONE badge per row and grew the strip to
        // 273px — taller than the product photo, and it made every card in the
        // grid a different height. One row keeps card heights uniform and lets
        // the logos stay at full legible size; the global 5px scrollbar
        // (globals.css) is the affordance that more badges are to the right.
        flexWrap: 'nowrap',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
      }}
      role="list"
      aria-label="Key product features"
    >
      {shown.map((f) => (
        <FeatureBadge key={f.slug} feature={f} size={size} />
      ))}

      {overflow.length > 0 && (
        // Compact pill sized to the logo row, not a captioned square tile — a
        // square "+N" + "more" label stood ~73px tall and single-handedly set the
        // height of the whole one-line strip. The full list of remaining feature
        // names stays in title/aria-label.
        <span
          role="listitem"
          title={overflow.map((f) => f.name).join(', ')}
          aria-label={`${overflow.length} more features: ${overflow.map((f) => f.name).join(', ')}`}
          style={{
            height: Math.round(size * 0.72),
            padding: '0 10px',
            borderRadius: 999,
            border: '1px dashed #D7D4CE',
            background: '#F5F3EF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#6E6257',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  );
}
