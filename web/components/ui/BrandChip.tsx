/**
 * BrandChip — small pill that renders a product's brand name. Presentational,
 * server-safe (no client directive). Used in product cards and detail pages.
 */
interface BrandChipProps {
  brand: string;
}

export default function BrandChip({ brand }: BrandChipProps) {
  return <span className="brand-chip">{brand}</span>;
}
