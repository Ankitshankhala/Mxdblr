'use client';

/**
 * StockBadge — colour-coded pill for a product's stock status (in stock / low /
 * out of stock). Size-configurable; used on product cards, grids, and detail.
 */
import type { StockStatus } from '@/types';

interface StockBadgeProps {
  status: StockStatus;
  size?: 'sm' | 'md' | 'lg';
}

const labelMap: Record<StockStatus, string> = {
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
};

const classMap: Record<StockStatus, string> = {
  IN_STOCK: 'badge-in',
  LOW_STOCK: 'badge-low',
  OUT_OF_STOCK: 'badge-out',
};

const dotColorMap: Record<StockStatus, string> = {
  IN_STOCK: '#2E7D32',
  LOW_STOCK: '#F59E0B',
  OUT_OF_STOCK: '#DC2626',
};

const sizeMap = {
  sm: { badge: 'text-[10px] px-2 py-0.5 gap-1', dot: 6 },
  md: { badge: 'text-xs px-2.5 py-1 gap-1.5', dot: 7 },
  lg: { badge: 'text-sm px-3 py-1.5 gap-2', dot: 8 },
};

export default function StockBadge({ status, size = 'md' }: StockBadgeProps) {
  const { badge, dot } = sizeMap[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${classMap[status]} ${badge}`}
    >
      <span
        className={status === 'IN_STOCK' ? 'pulse-dot' : ''}
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: dotColorMap[status],
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {labelMap[status]}
    </span>
  );
}
