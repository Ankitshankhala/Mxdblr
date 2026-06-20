'use client';

/**
 * Dealer cart page (route: /cart). Shows the current dealer's cart, allows
 * quantity edits (respecting MOQ) and line removal, and converts the cart into a
 * WhatsApp inquiry (POST /api/inquiry → wa.me deep link). Dealer-auth only.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ShoppingBag, ChevronDown, MessageCircle, ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import BrandChip from '@/components/ui/BrandChip';
import SkuLabel from '@/components/ui/SkuLabel';
import StockBadge from '@/components/ui/StockBadge';
import QtyStepper from '@/components/ui/QtyStepper';
import { useCart } from '@/hooks/useCart';
import { notificationsApi } from '@/lib/api';
import type { CartItem } from '@/types';
import { whatsappLink } from '@/lib/config';

function buildWhatsAppMessage(items: CartItem[], dealerName = 'Dealer', shopName = 'Shop'): string {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. ${item.product.name} (SKU: ${item.product.sku}) — Qty: ${item.quantity} pcs`
  );
  return [
    `*MXD Wholesale Inquiry*`,
    ``,
    `Dealer: ${dealerName}`,
    `Shop: ${shopName}`,
    ``,
    `*Products:*`,
    ...lines,
    ``,
    `Please confirm availability and pricing.`,
    `_Sent via MXD Dealer Portal_`,
  ].join('\n');
}

interface CartItemRowProps {
  item: CartItem;
  onRemove: (productId: string) => void;
  onUpdateQty: (productId: string, qty: number) => void;
}

function CartItemRow({ item, onRemove, onUpdateQty }: CartItemRowProps) {
  const initials = item.product.brand.slice(0, 2).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px 0',
        borderBottom: '1px solid #E8E4DE',
        alignItems: 'flex-start',
      }}
    >
      {/* Product image */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          background: item.product.images?.[0] ? undefined : '#EEF0FE',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
          color: '#6366F1',
        }}
      >
        {item.product.images?.[0] ? (
          <Image
            src={item.product.images[0]}
            alt={item.product.name}
            width={72}
            height={72}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <BrandChip brand={item.product.brand} />
        <Link
          href={`/product/${item.product.sku}`}
          style={{ display: 'block', fontWeight: 700, fontSize: 14, color: '#1A1A2E', textDecoration: 'none', marginTop: 4, lineHeight: 1.3 }}
        >
          {item.product.name}
        </Link>
        <SkuLabel sku={item.product.sku} />
        <div style={{ marginTop: 8 }}>
          <StockBadge status={item.product.stockStatus} size="sm" />
        </div>
      </div>

      {/* Qty + remove */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}
          aria-label="Remove item"
        >
          <Trash2 size={16} />
        </button>
        <QtyStepper
          value={item.quantity}
          moq={item.product.moq}
          onChange={(qty) => onUpdateQty(item.productId, qty)}
        />
        <div style={{ fontSize: 12, color: '#6B6B7D', textAlign: 'right' }}>
          {item.quantity} pcs
        </div>
      </div>
    </motion.div>
  );
}

function WhatsAppPreview({ message }: { message: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          color: '#6B6B7D',
          padding: '10px 0',
        }}
      >
        Preview WhatsApp message
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: '#E5DDD5', borderRadius: 10, padding: 12 }}>
              <div
                style={{
                  background: '#DCF8C6',
                  borderRadius: '10px 10px 0 10px',
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'system-ui',
                  maxWidth: '90%',
                  marginLeft: 'auto',
                }}
              >
                {message}
              </div>
              <div style={{ fontSize: 10, color: '#6B6B7D', textAlign: 'right', marginTop: 4 }}>
                Delivered
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CartPage() {
  const { items, loading, removeFromCart, updateQuantity, count } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dealer, setDealer] = useState<{ ownerName?: string; shopName?: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mxd_dealer');
    if (raw) setDealer(JSON.parse(raw));
    setIsAuthenticated(!!localStorage.getItem('mxd_token'));
  }, []);

  const whatsappMessage = buildWhatsAppMessage(
    items,
    dealer?.ownerName || 'Dealer',
    dealer?.shopName || 'Shop'
  );

  const whatsappUrl = whatsappLink(whatsappMessage);

  async function handleWhatsAppInquiry() {
    if (!isAuthenticated) { window.location.href = '/auth'; return; }

    setSubmitting(true);
    try {
      await notificationsApi.submitInquiry(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
      setSubmitted(true);
    } catch {
      // Even if log fails, still open WhatsApp
    } finally {
      setSubmitting(false);
      window.open(whatsappUrl, '_blank');
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F6F2' }}>
        <Navbar />
        <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
          <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-safe-bottom-lg" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <h1 style={{ fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
          Inquiry Cart
          {count > 0 && (
            <span style={{ fontSize: 15, fontWeight: 600, color: '#6B6B7D', marginLeft: 10 }}>
              {count} items
            </span>
          )}
        </h1>
        <p style={{ color: '#6B6B7D', fontSize: 13, marginBottom: 28 }}>
          No pricing shown. Send inquiry via WhatsApp to get wholesale pricing.
        </p>

        {items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <ShoppingBag size={48} color="#E8E4DE" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Your cart is empty</h3>
            <p style={{ color: '#6B6B7D', marginBottom: 24 }}>Add products from the catalog to build your inquiry.</p>
            <Link href="/catalog" className="btn-orange" style={{ padding: '12px 24px', textDecoration: 'none' }}>
              Browse Catalog <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="cart-layout" style={{ gap: 24, alignItems: 'flex-start' }}>
            {/* Cart items */}
            <div className="card" style={{ padding: '0 20px' }}>
              <AnimatePresence>
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onRemove={removeFromCart}
                    onUpdateQty={updateQuantity}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Order summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Order Summary</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B6B7D' }}>Total Items</span>
                    <span style={{ fontWeight: 600 }}>{count} pcs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#6B6B7D' }}>Product Lines</span>
                    <span style={{ fontWeight: 600 }}>{items.length}</span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #E8E4DE',
                    paddingTop: 14,
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#A8A39A',
                    lineHeight: 1.5,
                  }}
                >
                  Pricing is not shown on this portal. Once you send this inquiry via WhatsApp, our team will share wholesale pricing within 2 hours.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginBottom: 20 }}>
                  <span>Delivery</span>
                  <span style={{ color: '#2E7D32' }}>Calculated on confirmation</span>
                </div>

                {submitted ? (
                  <div style={{ padding: '12px', background: '#E6F3E7', borderRadius: 10, textAlign: 'center', color: '#2E7D32', fontWeight: 700, fontSize: 14 }}>
                    Inquiry logged! WhatsApp opened.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-whatsapp"
                    style={{ width: '100%', padding: '14px', fontSize: 15 }}
                    onClick={handleWhatsAppInquiry}
                    disabled={submitting}
                  >
                    <MessageCircle size={20} />
                    {submitting ? 'Logging inquiry...' : 'Send WhatsApp Inquiry'}
                  </button>
                )}

                <div style={{ marginTop: 16 }}>
                  <WhatsAppPreview message={whatsappMessage} />
                </div>
              </div>

              <Link
                href="/catalog"
                className="btn-ghost"
                style={{ padding: '12px', fontSize: 14, justifyContent: 'center', textDecoration: 'none', width: '100%' }}
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
