/**
 * SkuLabel — renders a product SKU in a consistent monospace style.
 * Presentational, server-safe. Used across catalog and product detail.
 */
interface SkuLabelProps {
  sku: string;
}

export default function SkuLabel({ sku }: SkuLabelProps) {
  return (
    <span className="mono text-[10px]" style={{ color: '#6B6B7D' }}>
      SKU: {sku}
    </span>
  );
}
