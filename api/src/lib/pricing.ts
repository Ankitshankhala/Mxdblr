/**
 * Dealer price lists.
 *
 * Every product carries three per-piece prices (priceA/B/C). An admin assigns
 * each dealer one list (Dealer.priceTier) and switches prices on or off for
 * them (Dealer.showPrices, off by default). This module is the one place that
 * maps a dealer to "their" price, so the product page and the WhatsApp order
 * always quote the same number.
 *
 * Prices are financial data: admins only see or edit them with
 * ACCESS_FINANCIAL_DATA, and dealers only ever receive their own list's price.
 */
import { PriceTier, Prisma } from '@prisma/client';
import { z } from 'zod';

export interface TieredPrices {
  priceA: number | null;
  priceB: number | null;
  priceC: number | null;
}

export const PRICE_FIELDS = ['priceA', 'priceB', 'priceC'] as const;

/** Prisma `select` fragment for the three price columns. */
export const PRICE_SELECT = { priceA: true, priceB: true, priceC: true } as const;

/** A price as admins enter it: rupees, at most two decimals, or null to clear. */
export const priceInput = z
  .number()
  .min(0, 'Price cannot be negative')
  .max(10_000_000, 'Price is too large')
  .nullable()
  .transform((v) => (v === null ? null : roundPaise(v)));

export function priceForTier(product: TieredPrices, tier: PriceTier): number | null {
  if (tier === 'A') return product.priceA;
  if (tier === 'B') return product.priceB;
  return product.priceC;
}

export function roundPaise(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** ₹1,250 or ₹99.50: whole rupees drop the paise. Indian digit grouping. */
export function formatInr(amount: number): string {
  const whole = Number.isInteger(amount);
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * An inquiry's cartSnapshot with the quoted prices removed, for admins without
 * ACCESS_FINANCIAL_DATA. Items are kept; only unitPrice/priceTier go.
 */
export function snapshotForViewer(snapshot: Prisma.JsonValue, canSeePrices: boolean): Prisma.JsonValue {
  const items = Array.isArray(snapshot) ? snapshot : [];
  if (canSeePrices) return items;
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const { unitPrice: _unitPrice, priceTier: _priceTier, ...rest } = item;
    return rest;
  });
}
