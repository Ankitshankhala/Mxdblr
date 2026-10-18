/**
 * Rupee formatting for dealer prices. Mirrors formatInr in api/src/lib/pricing.ts,
 * so the product page and the WhatsApp order show a price the same way.
 */

/** ₹1,250 or ₹99.50: whole rupees drop the paise. Indian digit grouping. */
export function formatInr(amount: number): string {
  const whole = Number.isInteger(amount);
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function roundPaise(amount: number): number {
  return Math.round(amount * 100) / 100;
}
