/**
 * MSG91 messaging client — WhatsApp login codes + WhatsApp Business outbound.
 *
 * Three helpers: sendOtp (login/registration code, WhatsApp only),
 * sendWhatsAppMessage (restock/notification template), and
 * buildInquiryWhatsAppMessage (formats a dealer cart into the wa.me inquiry
 * text). Until WhatsApp login codes are set up (MSG91_AUTH_KEY,
 * MSG91_WHATSAPP_NUMBER, MSG91_WHATSAPP_OTP_TEMPLATE) sendOtp sends nothing and
 * returns success: the code is logged to the console in development, and in
 * production admins issue login codes by hand (Admin > Dealers). Credentials
 * come from env vars exclusively.
 */
import axios from 'axios';
import { formatInr, roundPaise } from './pricing';

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER || '';

// Login codes go out from their own MSG91 integrated number, NOT
// WHATSAPP_BUSINESS_NUMBER (that one stays on the WhatsApp Business app for the
// inquiry inbox). The template is a Meta-approved "Authentication" template whose
// body {{1}} is the code, with a copy-code button that also carries the code.
const WHATSAPP_OTP_NUMBER = process.env.MSG91_WHATSAPP_NUMBER || '';
const WHATSAPP_OTP_TEMPLATE = process.env.MSG91_WHATSAPP_OTP_TEMPLATE || '';
const WHATSAPP_OTP_LANGUAGE = process.env.MSG91_WHATSAPP_OTP_LANGUAGE || 'en';
const WHATSAPP_OTP_NAMESPACE = process.env.MSG91_WHATSAPP_OTP_NAMESPACE || '';

const WHATSAPP_BULK_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

/** True once everything needed to send login codes on WhatsApp is set. */
export function whatsappOtpConfigured(): boolean {
  return Boolean(MSG91_AUTH_KEY && WHATSAPP_OTP_NUMBER && WHATSAPP_OTP_TEMPLATE);
}

/** Sends a login code on WhatsApp. There is no SMS fallback. */
export async function sendOtp(mobile: string, otp: string): Promise<boolean> {
  if (!whatsappOtpConfigured()) {
    // Not set up yet: nothing is sent. Dev logs the code; production relies on
    // admin-issued login codes (POST /api/admin/dealers/login-code).
    if (process.env.NODE_ENV === 'development') {
      console.info(`[DEV] OTP for ${mobile}: ${otp}`);
    }
    return true;
  }

  try {
    const response = await axios.post(
      WHATSAPP_BULK_URL,
      {
        integrated_number: WHATSAPP_OTP_NUMBER,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: WHATSAPP_OTP_TEMPLATE,
            language: { code: WHATSAPP_OTP_LANGUAGE, policy: 'deterministic' },
            ...(WHATSAPP_OTP_NAMESPACE && { namespace: WHATSAPP_OTP_NAMESPACE }),
            to_and_components: [
              {
                to: [`91${mobile}`],
                components: {
                  body_1: { type: 'text', value: otp },
                  button_1: { subtype: 'url', type: 'text', value: otp },
                },
              },
            ],
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          authkey: MSG91_AUTH_KEY,
        },
        timeout: 10000,
      }
    );
    if (response.data?.hasError === true || response.data?.status === 'fail') {
      logOtpFailure(mobile, otp, response.status, response.data);
      return false;
    }
    return true;
  } catch (err) {
    const res = (err as { response?: { status?: number; data?: unknown } }).response;
    logOtpFailure(mobile, otp, res?.status, res?.data ?? (err as Error).message);
    return false;
  }
}

/** MSG91's reason for a failed send, for `pm2 logs mxdblr-api`. The code itself is masked. */
function logOtpFailure(mobile: string, otp: string, status: number | undefined, detail: unknown): void {
  const text = (typeof detail === 'string' ? detail : JSON.stringify(detail) ?? '').split(otp).join('******');
  console.error(`[MSG91] WhatsApp login code to ...${mobile.slice(-3)} failed (${status ?? 'no response'}): ${text.slice(0, 500)}`);
}

export async function sendWhatsAppMessage(mobile: string, message: string): Promise<boolean> {
  if (!MSG91_AUTH_KEY || !WHATSAPP_BUSINESS_NUMBER) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[DEV] WhatsApp to ${mobile}: ${message.substring(0, 80)}...`);
    }
    return true;
  }

  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        integrated_number: WHATSAPP_BUSINESS_NUMBER,
        content_type: 'template',
        payload: {
          to: `91${mobile}`,
          type: 'template',
          template: {
            name: 'restock_notification',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: message }],
              },
            ],
          },
        },
      },
      {
        headers: {
          authkey: MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * With `showPrices` (the dealer's prices are switched on), each line carries the
 * dealer's quoted unit price and line total, followed by an order total. Lines
 * with no price on the dealer's list say "price on request" and are left out of
 * the total.
 */
export function buildInquiryWhatsAppMessage(
  dealerName: string,
  shopName: string,
  items: Array<{ name: string; sku: string; quantity: number; unitPrice?: number | null }>,
  showPrices = false
): string {
  // Ends with the items (and total): no closing request line, no "Sent via" footer.
  const header = `*MXD Wholesale Inquiry*\n\nDealer: ${dealerName}\nShop: ${shopName}\n\n*Products Requested:*\n`;
  const line = (item: { name: string; sku: string; quantity: number }, i: number) =>
    `${i + 1}. ${item.name} (SKU: ${item.sku}) — Qty: ${item.quantity}`;

  if (!showPrices) {
    return `${header}${items.map(line).join('\n')}`;
  }

  let total = 0;
  let onRequest = 0;
  const itemLines = items
    .map((item, i) => {
      if (item.unitPrice == null) {
        onRequest++;
        return `${line(item, i)} — price on request`;
      }
      const lineTotal = roundPaise(item.unitPrice * item.quantity);
      total += lineTotal;
      return `${line(item, i)} × ${formatInr(item.unitPrice)} = ${formatInr(lineTotal)}`;
    })
    .join('\n');

  const priced = items.length - onRequest;
  const totalLine = priced > 0
    ? `\n\n*Total: ${formatInr(roundPaise(total))}*${onRequest ? ` (+ ${onRequest} item${onRequest === 1 ? '' : 's'} on request)` : ''}`
    : '';

  return `${header}${itemLines}${totalLine}`;
}
