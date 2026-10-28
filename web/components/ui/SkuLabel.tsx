/**
 * SkuLabel — renders a product SKU in a consistent monospace style.
 * Presentational, server-safe. Used across catalog and product detail.
 * `className` adds to the label's own classes (e.g. a responsive visibility rule).
 */
interface SkuLabelProps {
  sku: string;
  className?: string;
}

export default function SkuLabel({ sku, className }: SkuLabelProps) {
  return (
    <span className={className ? `mono text-[10px] ${className}` : 'mono text-[10px]'} style={{ color: '#6E6257' }}>
      SKU: {sku}
    </span>
  );
}
