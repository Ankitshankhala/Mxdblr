/**
 * MSG91 messaging client — OTP SMS + WhatsApp Business outbound.
 *
 * Three helpers: sendOtp (login/registration OTP), sendWhatsAppMessage
 * (restock/notification template), and buildInquiryWhatsAppMessage (formats a
 * dealer cart into the wa.me inquiry text). When MSG91_AUTH_KEY is unset the
 * send helpers no-op and return success (dev mock — OTP is logged to the console
 * in development only), so the full auth flow is testable without a live key.
 * Credentials come from env vars exclusively.
 */
import axios from 'axios';
import { formatInr, roundPaise } from './pricing';

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'MXDBLR';
const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER || '';

export async function sendOtp(mobile: string, otp: string): Promise<boolean> {
  if (!MSG91_AUTH_KEY) {
    // Dev mock: log OTP to console only in development
    if (process.env.NODE_ENV === 'development') {
      console.info(`[DEV] OTP for ${mobile}: ${otp}`);
    }
    return true;
  }

  try {
    const response = await axios.post(
      'https://control.msg91.com/api/v5/otp',
      {
        template_id: MSG91_TEMPLATE_ID,
        mobile: `91${mobile}`,
        otp,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          authkey: MSG91_AUTH_KEY,
        },
        timeout: 10000,
      }
    );
    return response.data?.type === 'success';
  } catch {
    return false;
  }
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
  const header = `*MXD Wholesale Inquiry*\n\nDealer: ${dealerName}\nShop: ${shopName}\n\n*Products Requested:*\n`;
  const footer = '\n\n_Sent via MXD Dealer Portal_';
  const line = (item: { name: string; sku: string; quantity: number }, i: number) =>
    `${i + 1}. ${item.name} (SKU: ${item.sku}) — Qty: ${item.quantity}`;

  if (!showPrices) {
    const itemLines = items.map(line).join('\n');
    return `${header}${itemLines}\n\nPlease confirm availability and share pricing.${footer}`;
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
  const ask = onRequest
    ? 'Please confirm availability and share pricing for the items on request.'
    : 'Please confirm availability.';

  return `${header}${itemLines}${totalLine}\n\n${ask}${footer}`;
}
