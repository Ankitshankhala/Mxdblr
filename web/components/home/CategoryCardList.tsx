'use client';

/**
 * CategoryCardList — homepage grid of category cards linking into the filtered
 * catalog (/catalog?category=…). Fetches categories from the API.
 */
import Link from 'next/link';
import Image from 'next/image';
import { Zap, Headphones, Usb, Smartphone, Shield, PlugZap, MonitorSmartphone } from 'lucide-react';

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

// Icon palette cycles for categories that have no image
const ICON_PALETTE = [
  { Icon: Zap,               color: '#FFF3E8', iconColor: '#F47920' },
  { Icon: Headphones,        color: '#FCE7E7', iconColor: '#DC2626' },
  { Icon: Usb,               color: '#EEF0FE', iconColor: '#6366F1' },
  { Icon: Smartphone,        color: '#E6F3E7', iconColor: '#2E7D32' },
  { Icon: Shield,            color: '#FEF3D7', iconColor: '#F59E0B' },
  { Icon: PlugZap,           color: '#F0FDF4', iconColor: '#16A34A' },
  { Icon: MonitorSmartphone, color: '#EEF0FE', iconColor: '#6366F1' },
];

export default function CategoryCardList({ categories }: { categories: ApiCategory[] }) {
  if (categories.length === 0) {
    // Skeleton state
    return (
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollbarWidth: 'none',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card" style={{ width: 160, padding: '16px 14px', flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, background: '#F0EDEA', borderRadius: 10, marginBottom: 10 }} />
            <div style={{ height: 12, background: '#F0EDEA', borderRadius: 4, marginBottom: 6, width: '80%' }} />
            <div style={{ height: 10, background: '#F5F3F0', borderRadius: 4, width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
        scrollbarWidth: 'none',
      }}
    >
      {categories.map((cat, idx) => {
        const palette = ICON_PALETTE[idx % ICON_PALETTE.length];
        const { Icon, color, iconColor } = palette;
        return (
          <Link key={cat.id} href={`/catalog?category=${cat.slug}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div
              className="card"
              style={{ width: 160, padding: '16px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#F47920')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#E8E4DE')}
            >
              {cat.image ? (
                <div style={{ position: 'relative', width: 44, height: 44, marginBottom: 10 }}>
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    style={{ objectFit: 'cover', borderRadius: 10 }}
                    sizes="44px"
                  />
                </div>
              ) : (
                <div style={{ width: 44, height: 44, background: color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon size={20} color={iconColor} />
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: '#6B6B7D' }}>
                {cat.description || `${cat.productCount ?? 0} products`}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
