'use client';

/**
 * Dealer account dashboard (route: /account). Landing page for a signed-in
 * dealer — profile summary and inquiry history (GET /api/dealers/me/inquiries),
 * with links to profile edit and wishlist. Redirects to /auth when unauthenticated.
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, Clock, CheckCheck, Archive,
  ShoppingBag, Store, Phone, FileText, MessageCircle,
  ChevronRight, LogOut, Package, TrendingUp, User,
  Headphones, RotateCcw, Bell,
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { dealerApi, clearToken } from '@/lib/api';
import type { Dealer, BusinessType } from '@/types';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type InquiryStatus = 'NEW' | 'VIEWED' | 'RESPONDED' | 'CLOSED';

interface SnapshotProduct {
  id: string; name: string; brand: string; sku: string; moq: number;
}

interface SnapshotItem {
  productId: string; quantity: number; product: SnapshotProduct | null;
}

interface InquiryLog {
  id: string; dealerId: string; cartSnapshot: SnapshotItem[];
  whatsappSentAt: string; status: InquiryStatus; createdAt: string;
}

interface TopProduct {
  productId: string; name: string; brand: string; sku: string;
  totalQty: number; lastDate: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RETAIL_SHOP: 'Retail Shop', WHOLESALER: 'Wholesaler',
  DISTRIBUTOR: 'Distributor', REPAIR_SHOP: 'Repair Shop',
  ONLINE_SELLER: 'Online Seller', MOBILE_ACCESSORIES_STORE: 'Mobile Accessories Store',
};

const STATUS_CONFIG: Record<InquiryStatus, { label: string; bg: string; color: string }> = {
  NEW:       { label: 'Pending',      bg: '#FFF3E8', color: '#C05A00' },
  VIEWED:    { label: 'Under Review', bg: '#EEF0FE', color: '#4338CA' },
  RESPONDED: { label: 'Responded',    bg: '#D1FAE5', color: '#065F46' },
  CLOSED:    { label: 'Closed',       bg: '#F3F4F6', color: '#374151' },
};

const DEALER_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:    { bg: '#D1FAE5', color: '#065F46', label: 'Verified Dealer' },
  SUSPENDED: { bg: '#FEF3C7', color: '#92400E', label: 'Suspended'       },
  BLOCKED:   { bg: '#FEE2E2', color: '#991B1B', label: 'Blocked'         },
  REJECTED:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected'        },
};

/* ── Helper components ──────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, accent, sub,
}: {
  icon: React.ReactNode; label: string; value: number;
  accent: string; sub?: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E4DE', borderRadius: 12,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: `${accent}18`, color: accent, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B6B7D', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#A8A39A', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{title}</h2>
      {action}
    </div>
  );
}

function QuickLink({ href, icon, label, description, isExternal }: {
  href: string; icon: React.ReactNode; label: string; description: string; isExternal?: boolean;
}) {
  const linkContent = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      textDecoration: 'none', color: '#1A1A2E',
      borderBottom: '1px solid #F8F6F2', cursor: 'pointer',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: '#FFF3E8', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#F47920',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#6B6B7D', marginTop: 1 }}>{description}</div>
      </div>
      <ChevronRight size={15} color="#A8A39A" />
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        {linkContent}
      </a>
    );
  }
  return <Link href={href} style={{ textDecoration: 'none' }}>{linkContent}</Link>;
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function AccountDashboard() {
  const router = useRouter();
  const [dealer, setDealer]       = useState<Dealer | null>(null);
  const [inquiries, setInquiries] = useState<InquiryLog[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dealerToken') || localStorage.getItem('mxd_token');
    if (!token) { router.replace('/auth'); return; }

    Promise.all([
      dealerApi.me(),
      dealerApi.myInquiries(),
    ])
      .then(([meRes, inqRes]) => {
        const d: Dealer = meRes.data.data;
        setDealer(d);
        localStorage.setItem('mxd_dealer', JSON.stringify(d));
        setInquiries((inqRes.data.data as InquiryLog[]) || []);
      })
      .catch(() => router.replace('/auth'))
      .finally(() => setLoading(false));
  }, [router]);

  /* Derived stats */
  const stats = useMemo(() => ({
    total:     inquiries.length,
    pending:   inquiries.filter(i => i.status === 'NEW' || i.status === 'VIEWED').length,
    responded: inquiries.filter(i => i.status === 'RESPONDED').length,
    closed:    inquiries.filter(i => i.status === 'CLOSED').length,
  }), [inquiries]);

  /* Recent 5 inquiries */
  const recentInquiries = inquiries.slice(0, 5);

  /* Top reorder products */
  const topProducts = useMemo<TopProduct[]>(() => {
    const map: Record<string, TopProduct> = {};
    inquiries.forEach(inq => {
      (inq.cartSnapshot || []).forEach(item => {
        if (!item.product) return;
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            name: item.product.name,
            brand: item.product.brand,
            sku: item.product.sku,
            totalQty: 0,
            lastDate: inq.createdAt,
          };
        }
        map[item.productId].totalQty += item.quantity;
        if (new Date(inq.createdAt) > new Date(map[item.productId].lastDate)) {
          map[item.productId].lastDate = inq.createdAt;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty).slice(0, 4);
  }, [inquiries]);

  function handleLogout() {
    clearToken();
    router.push('/auth');
  }

  /* Loading skeleton */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F6F2' }}>
        <Navbar />
        <MobileBottomNav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#6B6B7D' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', border: '3px solid #F47920',
              borderTopColor: 'transparent', margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14 }}>Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dealer) return null;

  const dealerStatus = DEALER_STATUS_STYLES[dealer.status] || DEALER_STATUS_STYLES.ACTIVE;
  const memberSince  = new Date(dealer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* ── Hero header ────────────────────────────────────────────────── */}
        <div style={{
          background: '#1A1A2E', borderRadius: 16, padding: '24px 24px',
          marginBottom: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#F47920',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 22, flexShrink: 0,
            }}>
              {dealer.ownerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6B6B7D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                Welcome back
              </div>
              <h1 style={{ fontWeight: 800, fontSize: 20, color: '#fff', marginBottom: 2, lineHeight: 1.2 }}>
                {dealer.shopName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                  background: dealerStatus.bg, color: dealerStatus.color,
                }}>
                  {dealerStatus.label}
                </span>
                <span style={{ fontSize: 11, color: '#6B6B7D' }}>
                  Member since {memberSince}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.65)', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12, marginBottom: 20,
        }}
          className="stats-grid"
        >
          <StatCard icon={<ClipboardList size={18} />} label="Total Inquiries" value={stats.total}    accent="#1A1A2E" sub="All time" />
          <StatCard icon={<Clock size={18} />}         label="Pending Reply"   value={stats.pending}  accent="#F47920" sub="Awaiting response" />
          <StatCard icon={<CheckCheck size={18} />}    label="Responded"       value={stats.responded} accent="#059669" sub="Dealt with" />
          <StatCard icon={<Archive size={18} />}       label="Closed"          value={stats.closed}   accent="#6B6B7D" sub="Completed" />
        </div>

        {/* ── Recent Inquiries ───────────────────────────────────────────── */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <SectionHeader
            title="Recent Inquiries"
            action={
              inquiries.length > 5 ? (
                <span style={{ fontSize: 12, color: '#F47920', fontWeight: 600 }}>
                  {inquiries.length} total
                </span>
              ) : undefined
            }
          />

          {recentInquiries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: '#6B6B7D' }}>
              <Package size={32} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No inquiries yet</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Browse the catalog and submit your first inquiry.</p>
              <Link
                href="/catalog"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 14, padding: '9px 18px', borderRadius: 8,
                  background: '#F47920', color: '#fff', fontSize: 13,
                  fontWeight: 700, textDecoration: 'none',
                }}
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Inquiry #', 'Date', 'Items', 'Status'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 10px',
                        fontSize: 11, fontWeight: 700, color: '#6B6B7D',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: '1px solid #E8E4DE', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentInquiries.map(inq => {
                    const cfg    = STATUS_CONFIG[inq.status];
                    const items  = (inq.cartSnapshot || []).reduce((sum, i) => sum + i.quantity, 0);
                    const lines  = (inq.cartSnapshot || []).length;
                    const date   = new Date(inq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const shortId = inq.id.slice(-8).toUpperCase();
                    return (
                      <tr key={inq.id} style={{ borderBottom: '1px solid #F8F6F2' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 700, color: '#1A1A2E', fontFamily: 'monospace', fontSize: 12 }}>
                          #{shortId}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#6B6B7D', whiteSpace: 'nowrap' }}>
                          {date}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#1A1A2E' }}>
                          <span style={{ fontWeight: 600 }}>{items}</span>
                          <span style={{ color: '#6B6B7D', fontSize: 11 }}> units · {lines} SKU{lines !== 1 ? 's' : ''}</span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 9px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Buy Again ─────────────────────────────────────────────────── */}
        {topProducts.length > 0 && (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <SectionHeader
              title="Buy Again"
              action={
                <span style={{ fontSize: 12, color: '#6B6B7D' }}>
                  Based on your order history
                </span>
              }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {topProducts.map(p => (
                <Link
                  key={p.productId}
                  href={`/product/${p.sku}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '12px 14px', borderRadius: 10, border: '1px solid #E8E4DE',
                    textDecoration: 'none', background: '#FAFAFA',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: '#EEF0FE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#6366F1', flexShrink: 0,
                    }}>
                      <Package size={15} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      borderRadius: 999, background: '#F3F4F6', color: '#6B6B7D',
                    }}>
                      {p.totalQty} units
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.3 }}>
                      {p.name.length > 32 ? p.name.slice(0, 32) + '…' : p.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B6B7D', marginTop: 2 }}>
                      {p.brand} · {p.sku}
                    </div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, color: '#F47920', marginTop: 2,
                  }}>
                    <RotateCcw size={11} /> Reorder
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Two-column row: Business Summary + Quick Actions ──────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16, marginBottom: 20,
        }}>
          {/* Business Summary */}
          <div className="card" style={{ padding: 20 }}>
            <SectionHeader title="Business Summary" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { icon: <Store size={13} />,   label: 'Shop',     value: dealer.shopName },
                { icon: <User size={13} />,    label: 'Owner',    value: dealer.ownerName },
                { icon: <TrendingUp size={13} />, label: 'Type', value: BUSINESS_TYPE_LABELS[dealer.businessType] || dealer.businessType },
                { icon: <Phone size={13} />,   label: 'Mobile',   value: `+91 ${dealer.mobile}` },
                { icon: <FileText size={13} />, label: 'GST',     value: dealer.gstNumber || 'Not added' },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0', borderBottom: '1px solid #F8F6F2',
                }}>
                  <div style={{ color: '#F47920', flexShrink: 0 }}>{row.icon}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B6B7D', minWidth: 44 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', flex: 1, textAlign: 'right', wordBreak: 'break-word' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Link
                href="/account/profile"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '9px 0', borderRadius: 8,
                  border: '1px solid #E8E4DE', background: '#fff',
                  fontSize: 12, fontWeight: 700, color: '#1A1A2E', textDecoration: 'none',
                }}
              >
                View Full Profile
              </Link>
              <Link
                href="/account/profile"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '9px 0', borderRadius: 8,
                  background: '#F47920', color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}
              >
                Edit Profile
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: 20 }}>
            <SectionHeader title="Quick Actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <QuickLink
                href="/catalog"
                icon={<Store size={16} />}
                label="Browse Catalog"
                description="Explore all wholesale products"
              />
              <QuickLink
                href="/cart"
                icon={<ShoppingBag size={16} />}
                label="My Cart"
                description="Review and place your inquiry"
              />
              <QuickLink
                href="/wishlist"
                icon={<Bell size={16} />}
                label="Wishlist"
                description="Products saved for later"
              />
              <QuickLink
                href={`https://wa.me/919769444053?text=Hi%2C%20I%20need%20support.%20My%20shop%3A%20${encodeURIComponent(dealer.shopName)}`}
                icon={<MessageCircle size={16} />}
                label="WhatsApp Support"
                description="Chat with our team directly"
                isExternal
              />
              <QuickLink
                href="/account/profile"
                icon={<Headphones size={16} />}
                label="Profile Settings"
                description="Manage your account details"
              />
            </div>
          </div>
        </div>

        {/* ── Notifications placeholder ──────────────────────────────────── */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <SectionHeader
            title="Notifications"
            action={
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: '#FFF3E8', color: '#C05A00',
              }}>
                Coming Soon
              </span>
            }
          />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
            background: '#F8F6F2', borderRadius: 10, color: '#6B6B7D',
          }}>
            <Bell size={20} style={{ flexShrink: 0, opacity: 0.4 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No notifications</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                Order updates, payment alerts, and new arrivals will appear here.
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Responsive stats-grid: 4 columns on desktop */}
      <style>{`
        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
