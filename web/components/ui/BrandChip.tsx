/**
 * BrandChip — small pill that renders a product's brand name. Presentational,
 * server-safe (no client directive). Used in product cards and detail pages.
 * `className` adds to the pill's own class (e.g. a responsive visibility rule).
 */
interface BrandChipProps {
  brand: string;
  className?: string;
}

export default function BrandChip({ brand, className }: BrandChipProps) {
  return <span className={className ? `brand-chip ${className}` : 'brand-chip'}>{brand}</span>;
}
