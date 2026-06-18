interface BrandChipProps {
  brand: string;
}

export default function BrandChip({ brand }: BrandChipProps) {
  return <span className="brand-chip">{brand}</span>;
}
