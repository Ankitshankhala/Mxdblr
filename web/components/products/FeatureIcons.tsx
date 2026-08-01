'use client';

/**
 * FeatureIcons — "Highlighted Key Features" strip for a product card (brief Option C).
 * Each badge is a 48px feature asset stacked above its short name, so a customer
 * reads product capabilities at a glance instead of decoding tiny icons. Shows up
 * to `max` (default 4) badges; overflow collapses into a refined "+N more" badge
 * whose tooltip lists the remaining names.
 *
 * IMPORTANT — no wrapping frame around the asset. The seeded placeholder SVGs (and
 * most real brand logos) already carry their own rounded border/background, so an
 * extra bordered container renders a box-in-a-box and makes the logo look smaller.
 * The asset is shown at full size; the name label provides the recognition.
 *
 * Asset resolves from feature.image / feature.logo (uploaded URL,
 * /public/product-features/<slug>.svg, or inline SVG data-URI). Image takes
 * priority over icon unless displayMode is explicitly ICON; a broken/empty asset
 * falls back to the other, then to a monogram so the slot never renders blank.
 * The feature name is always visible as a label AND exposed via title/aria-label
 * (hover tooltip on desktop, long-press on mobile). Read-only, presentational.
 */
import { useState } from 'react';
import type { ProductFeature } from '@/types';
import { normalizeImageUrl } from '@/lib/config';

interface FeatureIconsProps {
  features: ProductFeature[];
  max?: number;
  /** px size of the feature asset (default 48) */
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
        width: size + 20,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
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
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
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
    </span>
  );
}

export default function FeatureIcons({ features, max = 4, size = 48 }: FeatureIconsProps) {
  if (!features || features.length === 0) return null;

  const shown = features.slice(0, max);
  const overflow = features.slice(max);

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}
      role="list"
      aria-label="Key product features"
    >
      {shown.map((f) => (
        <FeatureBadge key={f.slug} feature={f} size={size} />
      ))}

      {overflow.length > 0 && (
        <span
          role="listitem"
          title={overflow.map((f) => f.name).join(', ')}
          aria-label={`${overflow.length} more features: ${overflow.map((f) => f.name).join(', ')}`}
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            width: size + 20,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: size,
              height: size,
              borderRadius: 12,
              border: '1px dashed #D7D4CE',
              background: '#F5F3EF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#6B6B7D',
            }}
          >
            +{overflow.length}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#8A8A96', lineHeight: 1.15 }}>more</span>
        </span>
      )}
    </div>
  );
}
