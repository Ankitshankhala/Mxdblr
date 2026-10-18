/**
 * Stock status follows stock quantity.
 *
 * Once a product's quantity is counted (stockQty not null) its status is always
 * worked out from it here, on every write, so the two can never disagree:
 *   0 or less             -> OUT_OF_STOCK
 *   1 .. lowStockThreshold -> LOW_STOCK   (SystemSettings, default 10)
 *   more                  -> IN_STOCK
 * stockQty null means "not counted yet": the status is whatever an admin set by
 * hand, and the dashboard reports how many products are still uncounted.
 */
import { StockStatus } from '@prisma/client';
import prisma from './prisma';

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const SETTINGS_ID = 1;

export function stockStatusFor(qty: number, lowStockThreshold: number): StockStatus {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export async function getLowStockThreshold(): Promise<number> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { lowStockThreshold: true },
  });
  return settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

export interface StockFields {
  stockQty?: number | null;
  stockStatus?: StockStatus;
}

/**
 * The stock fields to store for a product write.
 * - A quantity decides the status (any status sent alongside is ignored).
 * - null clears the count; the status sent (if any) is then kept as set by hand.
 * - A status sent on its own is only allowed while the product isn't counted;
 *   `currentQty` is the product's stored quantity (undefined when creating).
 */
export function resolveStock(
  input: StockFields,
  currentQty: number | null | undefined,
  lowStockThreshold: number,
): { ok: true; data: StockFields } | { ok: false; message: string } {
  if (typeof input.stockQty === 'number') {
    return { ok: true, data: { stockQty: input.stockQty, stockStatus: stockStatusFor(input.stockQty, lowStockThreshold) } };
  }
  if (input.stockQty === null) {
    return { ok: true, data: { stockQty: null, ...(input.stockStatus && { stockStatus: input.stockStatus }) } };
  }
  if (input.stockStatus && currentQty != null) {
    return {
      ok: false,
      message: `This product's stock is counted (${currentQty} pcs), so its status comes from the quantity. Change the quantity instead.`,
    };
  }
  return { ok: true, data: input.stockStatus ? { stockStatus: input.stockStatus } : {} };
}

/** Re-derive the status of every counted product, e.g. after the threshold changes. */
export function recomputeCountedStatuses(lowStockThreshold: number) {
  return [
    prisma.product.updateMany({ where: { stockQty: { lte: 0 } }, data: { stockStatus: 'OUT_OF_STOCK' } }),
    prisma.product.updateMany({ where: { stockQty: { gt: 0, lte: lowStockThreshold } }, data: { stockStatus: 'LOW_STOCK' } }),
    prisma.product.updateMany({ where: { stockQty: { gt: lowStockThreshold } }, data: { stockStatus: 'IN_STOCK' } }),
  ];
}
