// Single source of truth for the business WhatsApp number that receives all
// customer-facing messages (cart inquiries, contact buttons, support, the floating
// chat button). Stored without the leading "+" for use in wa.me links.
// Override per-environment with NEXT_PUBLIC_WHATSAPP_NUMBER if the number changes.
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919769444053";

/** Build a wa.me deep link, optionally with a pre-filled message. */
export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
