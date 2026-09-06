'use client';

/**
 * ProductActions — client island on the (server-rendered) product detail page.
 * Quantity stepper + add-to-cart (enforcing MOQ) and the back-in-stock "notify
 * me" action for out-of-stock items.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Heart, Bell, ChevronDown } from 'lucide-react';
import QtyStepper from '@/components/ui/QtyStepper';
import { cartApi, notificationsApi } from '@/lib/api';
import { useWishlist } from '@/hooks/useWishlist';
import type { Product } from '@/types';

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '1px solid #E8E4DE' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 14,
          color: '#1F1813',
          textAlign: 'left',
        }}
      >
        {title}
        <ChevronDown
          size={16}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: 16, fontSize: 14, color: '#6E6257', lineHeight: 1.7 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductActions({ product }: { product: Product }) {
  const [qty, setQty] = useState(product.moq);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMsg, setCartMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifySent, setNotifySent] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const { toggle, isWishlisted } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const isOutOfStock = product.stockStatus === 'OUT_OF_STOCK';

  async function handleAddToCart() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mxd_token') : null;
    if (!token) { window.location.href = '/auth'; return; }

    setAddingToCart(true);
    try {
      await cartApi.addOrUpdate(product.id, qty);
      setCartMsg({ type: 'success', text: 'Added to cart!' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to add';
      setCartMsg({ type: 'error', text: msg });
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMsg(null), 3000);
    }
  }

  async function handleNotifyMe(e: React.FormEvent) {
    e.preventDefault();
    setNotifyLoading(true);
    try {
      await notificationsApi.notifyMe(product.id, notifyPhone);
      setNotifySent(true);
    } catch {
      // ignore
    } finally {
      setNotifyLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cart actions */}
      {!isOutOfStock ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <QtyStepper value={qty} moq={product.moq} onChange={setQty} />
            <button
              type="button"
              className="btn-orange"
              style={{ flex: 1, padding: '0 20px', height: 36, minWidth: 160, fontSize: 14 }}
              onClick={handleAddToCart}
              disabled={addingToCart || qty < product.moq}
            >
              <ShoppingBag size={16} />
              {addingToCart ? 'Adding...' : '+ Add to Inquiry Cart'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ height: 36, padding: '0 14px', fontSize: 14 }}
              onClick={() => toggle(product.id)}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart
                size={16}
                fill={wishlisted ? '#F47920' : 'none'}
                color={wishlisted ? '#F47920' : '#1F1813'}
              />
              {wishlisted ? 'Saved' : 'Save'}
            </button>
          </div>

          {cartMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: cartMsg.type === 'success' ? '#E6F3E7' : '#FCE7E7',
                color: cartMsg.type === 'success' ? '#2E7D32' : '#DC2626',
              }}
            >
              {cartMsg.text}
            </div>
          )}
        </div>
      ) : (
        /* Notify Me — OUT_OF_STOCK */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ alignSelf: 'flex-start', height: 36, padding: '0 14px', fontSize: 14 }}
            onClick={() => toggle(product.id)}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          >
            <Heart
              size={16}
              fill={wishlisted ? '#F47920' : 'none'}
              color={wishlisted ? '#F47920' : '#1F1813'}
            />
            {wishlisted ? 'Saved' : 'Save'}
          </button>

          <div id="notify" style={{ background: '#FCE7E7', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#DC2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={16} /> Out of Stock — Get Notified
            </div>
            <p style={{ fontSize: 13, color: '#6E6257', marginBottom: 12 }}>
              Enter your mobile number to be notified when this product is back in stock.
            </p>
            {notifySent ? (
              <div style={{ color: '#2E7D32', fontWeight: 600, fontSize: 13 }}>
                You will be notified on WhatsApp when stock is available.
              </div>
            ) : (
              <form onSubmit={handleNotifyMe} style={{ display: 'flex', gap: 8 }}>
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', border: '1px solid #E8E4DE', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <span style={{ padding: '0 10px', fontSize: 13, color: '#6E6257', borderRight: '1px solid #E8E4DE' }}>+91</span>
                  <input
                    type="tel"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    required
                    value={notifyPhone}
                    onChange={(e) => setNotifyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Mobile number"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 14 }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-orange"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                  disabled={notifyLoading}
                >
                  {notifyLoading ? '...' : 'Notify Me'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Compatibility tags */}
      {product.compatibilityTags && product.compatibilityTags.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6E6257', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Compatible with
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {product.compatibilityTags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: '#F8F6F2',
                  border: '1px solid #E8E4DE',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1F1813',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Accordions */}
      <div style={{ marginTop: 8 }}>
        <Accordion title="Description" defaultOpen>
          {product.description || 'No description available for this product.'}
        </Accordion>
        <Accordion title="Specifications">
          {product.attributes && product.attributes.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {product.attributes.map((attr, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F8F6F2' }}>
                    <td style={{ padding: '6px 0', color: '#6E6257', fontSize: 13, width: '40%' }}>{attr.name}</td>
                    <td style={{ padding: '6px 0', fontWeight: 600, fontSize: 13 }}>{attr.value}{attr.unit ? ` ${attr.unit}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : 'No specifications listed.'}
        </Accordion>
        <Accordion title="Shipping Info">
          Orders are dispatched within 1–2 business days after WhatsApp inquiry confirmation. Free delivery on orders above ₹5,000. Serviceable across Karnataka, Tamil Nadu &amp; Andhra Pradesh.
        </Accordion>
      </div>
    </div>
  );
}
