'use client';

/**
 * Dealer profile edit page (route: /account/profile). Form to view and update the
 * dealer's profile via PUT /api/dealers/me. Dealer-auth only.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Phone, Store, MapPin, FileText, ArrowLeft,
  Save, X, CheckCircle, AlertCircle, Edit2, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { dealerApi, clearToken } from '@/lib/api';
import type { Dealer, BusinessType } from '@/types';

/* ── Constants ──────────────────────────────────────────────────────────────── */
const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RETAIL_SHOP: 'Retail Shop', WHOLESALER: 'Wholesaler',
  DISTRIBUTOR: 'Distributor', REPAIR_SHOP: 'Repair Shop',
  ONLINE_SELLER: 'Online Seller', MOBILE_ACCESSORIES_STORE: 'Mobile Accessories Store',
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:    { bg: '#D1FAE5', color: '#065F46', label: 'Active'    },
  SUSPENDED: { bg: '#FEF3C7', color: '#92400E', label: 'Suspended' },
  BLOCKED:   { bg: '#FEE2E2', color: '#991B1B', label: 'Blocked'   },
  REJECTED:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected'  },
};

interface EditForm {
  ownerName: string; shopName: string; whatsappNumber: string;
  altMobile: string; city: string; tehsil: string; district: string;
  state: string; pincode: string; gstNumber: string;
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #E8E4DE', borderRadius: 10,
  padding: '10px 14px', fontSize: 14, outline: 'none',
  background: '#F8F6F2', color: '#1A1A2E', fontFamily: 'inherit', boxSizing: 'border-box',
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#FFF3E8',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F47920',
        }}>
          {icon}
        </div>
        <h2 style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #F8F6F2', gap: 16,
    }}>
      <span style={{ fontSize: 12, color: '#6B6B7D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#1A1A2E', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B6B7D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
      {children}
    </label>
  );
}

function PhoneInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E8E4DE', borderRadius: 10, overflow: 'hidden', background: '#F8F6F2' }}>
      <span style={{ padding: '10px 10px', fontSize: 12, color: '#6B6B7D', borderRight: '1px solid #E8E4DE', whiteSpace: 'nowrap' }}>+91</span>
      <input
        type="tel" maxLength={10} value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 14, background: 'transparent' }}
      />
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function ProfileSettingsPage() {
  const router = useRouter();
  const [dealer, setDealer]           = useState<Dealer | null>(null);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [form, setForm] = useState<EditForm>({
    ownerName: '', shopName: '', whatsappNumber: '', altMobile: '',
    city: '', tehsil: '', district: '', state: '', pincode: '', gstNumber: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('dealerToken') || localStorage.getItem('mxd_token');
    if (!token) { router.replace('/auth'); return; }

    dealerApi.me()
      .then(res => {
        const d: Dealer = res.data.data;
        setDealer(d);
        setForm({
          ownerName:      d.ownerName,
          shopName:       d.shopName,
          whatsappNumber: d.whatsappNumber,
          altMobile:      d.altMobile || '',
          city:           d.city,
          tehsil:         d.tehsil,
          district:       d.district,
          state:          d.state,
          pincode:        d.pincode,
          gstNumber:      d.gstNumber || '',
        });
        localStorage.setItem('mxd_dealer', JSON.stringify(d));
      })
      .catch(() => router.replace('/auth'))
      .finally(() => setLoading(false));
  }, [router]);

  function update(field: keyof EditForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await dealerApi.update({
        ownerName:      form.ownerName      || undefined,
        shopName:       form.shopName       || undefined,
        whatsappNumber: form.whatsappNumber || undefined,
        altMobile:      form.altMobile      || undefined,
        city:           form.city           || undefined,
        tehsil:         form.tehsil         || undefined,
        district:       form.district       || undefined,
        state:          form.state          || undefined,
        pincode:        form.pincode        || undefined,
        gstNumber:      form.gstNumber      || undefined,
      });
      setDealer(prev => prev ? {
        ...prev,
        ownerName:      form.ownerName      || prev.ownerName,
        shopName:       form.shopName       || prev.shopName,
        whatsappNumber: form.whatsappNumber || prev.whatsappNumber,
        altMobile:      form.altMobile      || null,
        city:           form.city           || prev.city,
        tehsil:         form.tehsil         || prev.tehsil,
        district:       form.district       || prev.district,
        state:          form.state          || prev.state,
        pincode:        form.pincode        || prev.pincode,
        gstNumber:      form.gstNumber      || null,
      } : prev);
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save changes';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!dealer) return;
    setForm({
      ownerName:      dealer.ownerName,
      shopName:       dealer.shopName,
      whatsappNumber: dealer.whatsappNumber,
      altMobile:      dealer.altMobile || '',
      city:           dealer.city,
      tehsil:         dealer.tehsil,
      district:       dealer.district,
      state:          dealer.state,
      pincode:        dealer.pincode,
      gstNumber:      dealer.gstNumber || '',
    });
    setEditing(false);
    setSaveError('');
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F6F2' }}>
        <Navbar />
        <MobileBottomNav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#6B6B7D' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #F47920', borderTopColor: 'transparent', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14 }}>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dealer) return null;

  const statusStyle = STATUS_STYLES[dealer.status] || STATUS_STYLES.ACTIVE;

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar />
      <MobileBottomNav />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── Breadcrumb ───────────────────────────────────────────────── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6B7D', marginBottom: 20 }}>
          <Link href="/" style={{ color: '#6B6B7D', textDecoration: 'none' }}>Home</Link>
          <ChevronRight size={12} />
          <Link href="/account" style={{ color: '#6B6B7D', textDecoration: 'none' }}>My Account</Link>
          <ChevronRight size={12} />
          <span style={{ color: '#1A1A2E', fontWeight: 600 }}>Profile Settings</span>
        </nav>

        {/* ── Back button + header ─────────────────────────────────────── */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link
                href="/account"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 9, border: '1px solid #E8E4DE',
                  background: '#fff', color: '#1A1A2E', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <ArrowLeft size={16} />
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#F47920',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0,
                }}>
                  {dealer.ownerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 style={{ fontWeight: 800, fontSize: 16, color: '#1A1A2E', marginBottom: 2 }}>
                    {dealer.ownerName}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: statusStyle.bg, color: statusStyle.color,
                    }}>
                      {statusStyle.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#6B6B7D' }}>
                      Since {new Date(dealer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit / Save / Cancel buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8, border: '1px solid #E8E4DE',
                    background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1A1A2E',
                  }}
                >
                  <Edit2 size={14} /> Edit Profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 8, border: '1px solid #E8E4DE',
                      background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B6B7D',
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-orange"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13 }}
                  >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Save feedback ─────────────────────────────────────────────── */}
        {saveSuccess && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#D1FAE5', borderRadius: 10, marginBottom: 16, color: '#065F46', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle size={16} /> Profile updated successfully
          </div>
        )}
        {saveError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FEE2E2', borderRadius: 10, marginBottom: 16, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={16} /> {saveError}
          </div>
        )}

        {/* ── Business Information ──────────────────────────────────────── */}
        <Section icon={<Store size={16} />} title="Business Information">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <FieldLabel>Owner Name</FieldLabel>
                  <input style={inputStyle} value={form.ownerName} onChange={e => update('ownerName', e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Shop Name</FieldLabel>
                  <input style={inputStyle} value={form.shopName} onChange={e => update('shopName', e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Owner Name"   value={dealer.ownerName} />
              <InfoRow label="Shop Name"    value={dealer.shopName} />
              <InfoRow label="Business Type" value={BUSINESS_TYPE_LABELS[dealer.businessType] || dealer.businessType} />
              <InfoRow label="Member Since" value={new Date(dealer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </>
          )}
        </Section>

        {/* ── Contact Details ───────────────────────────────────────────── */}
        <Section icon={<Phone size={16} />} title="Contact Details">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <FieldLabel>WhatsApp Number</FieldLabel>
                  <PhoneInput value={form.whatsappNumber} onChange={v => update('whatsappNumber', v)} />
                </div>
                <div>
                  <FieldLabel>Alternate Mobile</FieldLabel>
                  <PhoneInput value={form.altMobile} onChange={v => update('altMobile', v)} placeholder="Optional" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Mobile (Login)" value={`+91 ${dealer.mobile}`} />
              <InfoRow label="WhatsApp"        value={`+91 ${dealer.whatsappNumber}`} />
              <InfoRow label="Alternate"       value={dealer.altMobile ? `+91 ${dealer.altMobile}` : null} />
            </>
          )}
        </Section>

        {/* ── Location ──────────────────────────────────────────────────── */}
        <Section icon={<MapPin size={16} />} title="Location">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>City</FieldLabel><input style={inputStyle} value={form.city} onChange={e => update('city', e.target.value)} /></div>
                <div><FieldLabel>Tehsil</FieldLabel><input style={inputStyle} value={form.tehsil} onChange={e => update('tehsil', e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><FieldLabel>District</FieldLabel><input style={inputStyle} value={form.district} onChange={e => update('district', e.target.value)} /></div>
                <div><FieldLabel>State</FieldLabel><input style={inputStyle} value={form.state} onChange={e => update('state', e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <FieldLabel>Pincode</FieldLabel>
                  <input
                    style={inputStyle} value={form.pincode} maxLength={6}
                    onChange={e => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="City"     value={dealer.city} />
              <InfoRow label="Tehsil"   value={dealer.tehsil} />
              <InfoRow label="District" value={dealer.district} />
              <InfoRow label="State"    value={dealer.state} />
              <InfoRow label="Country"  value={dealer.country} />
              <InfoRow label="Pincode"  value={dealer.pincode} />
            </>
          )}
        </Section>

        {/* ── Tax Information ───────────────────────────────────────────── */}
        <Section icon={<FileText size={16} />} title="Tax Information">
          {editing ? (
            <div>
              <FieldLabel>GST Number (Optional)</FieldLabel>
              <input
                style={inputStyle}
                value={form.gstNumber}
                onChange={e => update('gstNumber', e.target.value.toUpperCase())}
                placeholder="15-digit GSTIN"
                maxLength={15}
              />
              <p style={{ fontSize: 11, color: '#6B6B7D', marginTop: 6 }}>
                Leave blank if you do not have a GST number.
              </p>
            </div>
          ) : (
            <>
              <InfoRow label="GST Number" value={dealer.gstNumber} />
              {dealer.gstNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#D1FAE5', color: '#065F46' }}>
                    GST Registered
                  </span>
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Account Security ─────────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F8F6F2' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', marginBottom: 2 }}>Account Security</div>
            <div style={{ fontSize: 12, color: '#6B6B7D' }}>Your login mobile number cannot be changed for security reasons.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B7D' }}>
              <Phone size={15} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Login Mobile</div>
              <div style={{ fontSize: 12, color: '#6B6B7D' }}>+91 {dealer.mobile}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#D1FAE5', color: '#065F46' }}>
              Verified
            </span>
          </div>
        </div>

        {/* ── Back to dashboard ─────────────────────────────────────────── */}
        <Link
          href="/account"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '11px 20px', borderRadius: 9,
            border: '1px solid #E8E4DE', background: '#fff',
            color: '#1A1A2E', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

      </div>
    </div>
  );
}
