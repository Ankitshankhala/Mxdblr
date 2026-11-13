/**
 * Small display-formatting helpers shared across pages.
 */

/**
 * "1 unit" / "10 units" — MOQ is per-product and is frequently 1, so the
 * quantity label has to agree in number. Use this anywhere a raw
 * `{moq} units` would otherwise render "1 units".
 */
export function units(count: number): string {
  return `${count} ${count === 1 ? 'unit' : 'units'}`;
}
