// Single source of truth for the business WhatsApp number that receives all
// customer-facing messages (cart inquiries, contact buttons, support, the floating
// chat button). Stored without the leading "+" for use in wa.me links.
// Override per-environment with NEXT_PUBLIC_WHATSAPP_NUMBER if the number changes.
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919029363910";

/**
 * Build a wa.me deep link, optionally with a pre-filled message.
 * Pass `number` to override the default (e.g. the number returned by
 * POST /api/inquiry, which is the source of truth at send time) — prefer
 * the server-provided number over this module's default whenever available.
 */
export function whatsappLink(text?: string, number?: string): string {
  const base = `https://wa.me/${number || WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// API origin derived from NEXT_PUBLIC_API_URL (strip the trailing /api).
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

/**
 * Rewrite absolute dev upload URLs (http://localhost:4000/uploads/...) to the
 * configured API origin so images resolve on phones/LAN devices where "localhost"
 * means the device itself. Relative /uploads/... paths are made absolute against
 * the API origin. Cloudinary/remote URLs (no /uploads segment) pass through
 * untouched, so this is safe in production. Mirrors HeroBanner's inline normalizer.
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\/[^/]+\/uploads\//.test(url)) {
    return url.replace(/^https?:\/\/[^/]+(\/uploads\/)/, `${API_ORIGIN}$1`);
  }
  if (url.startsWith("/uploads/")) return `${API_ORIGIN}${url}`;
  return url;
}
