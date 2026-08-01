/**
 * SupportedTechnologies — full "Supported Fast Charging & Technologies" section
 * on the product detail page. Groups a product's features by category and renders
 * logo + name + description per item. Presentational Server Component (no client
 * state), so it stays SSR-friendly. Logos resolve from
 * /public/product-features/<slug>.svg (served by Next directly).
 */
import type { ProductFeature, ProductFeatureCategory } from '@/types';
import { normalizeImageUrl } from '@/lib/config';

const CATEGORY_LABELS: Record<ProductFeatureCategory, string> = {
  CHARGING: 'Supported Fast Charging',
  WIRELESS: 'Wireless Charging',
  CABLE: 'Connectors & Cable',
  DATA: 'Data Transfer',
  PROTECTION: 'Protection',
  CERTIFICATION: 'Certifications',
};

// Section display order.
const CATEGORY_ORDER: ProductFeatureCategory[] = [
  'CHARGING', 'WIRELESS', 'CABLE', 'DATA', 'PROTECTION', 'CERTIFICATION',
];

function monogram(f: ProductFeature): string {
  const parts = f.slug.split('-');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return f.slug.slice(0, 2).toUpperCase();
}

export default function SupportedTechnologies({ features }: { features: ProductFeature[] }) {
  if (!features || features.length === 0) return null;

  // Bucket features by category.
  const byCategory = new Map<ProductFeatureCategory, ProductFeature[]>();
  for (const f of features) {
    const list = byCategory.get(f.category) ?? [];
    list.push(f);
    byCategory.set(f.category, list);
  }

  const groups = CATEGORY_ORDER
    .map((cat) => ({ cat, items: byCategory.get(cat) ?? [] }))
    .filter((g) => g.items.length > 0);

  return (
    <section
      aria-label="Supported technologies"
      style={{
        marginTop: 32,
        background: '#fff',
        border: '1px solid #E8E4DE',
        borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      <h2 style={{ fontWeight: 800, fontSize: 18, color: '#1A1A2E', marginBottom: 4 }}>
        Supported Technologies
      </h2>
      <p style={{ fontSize: 12, color: '#A8A39A', marginBottom: 18 }}>
        Fast-charging standards, connectors and certifications this product supports.
      </p>

      {groups.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#F47920',
              marginBottom: 10,
            }}
          >
            {CATEGORY_LABELS[cat]}
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 10,
            }}
          >
            {items.map((f) => {
              const mode = f.displayMode ?? 'ICON';
              const showIcon = mode === 'ICON' || mode === 'BOTH';
              const showImage = (mode === 'IMAGE' || mode === 'BOTH') && !!f.image;
              return (
                <div
                  key={f.slug}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: '#F8F6F2',
                    border: '1px solid #E8E4DE',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {showIcon && (
                      <span
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          border: '1px solid #E5E3DE',
                          background: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {f.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={normalizeImageUrl(f.logo)}
                            alt={f.name}
                            width={44}
                            height={44}
                            style={{ objectFit: 'contain', padding: 4, width: '100%', height: '100%' }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{monogram(f)}</span>
                        )}
                      </span>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>{f.name}</div>
                      {f.description && (
                        <div style={{ fontSize: 12, color: '#6B6B7D', lineHeight: 1.4, marginTop: 2 }}>
                          {f.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {showImage && f.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={normalizeImageUrl(f.image)}
                      alt={f.name}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #E5E3DE', display: 'block', objectFit: 'cover', maxHeight: 160 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
