'use client';

/**
 * Dealer registration page (route: /register). Collects business details and
 * submits POST /api/auth/register. State is chosen from a fixed dropdown (the
 * server still independently enforces geo rules — the dropdown is convenience,
 * not the control). Uses AnimatePresence initial={false} for reliable first paint.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { authApi, setToken } from '@/lib/api';
import type { BusinessType } from '@/types';

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'RETAIL_SHOP', label: 'Retail Shop' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
];

const STEPS = ['Business Info', 'Location', 'Review'];

// Allowed states are highlighted; others shown but will be rejected by the server
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const SERVED_STATES = new Set(['Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana']);

interface FormData {
  ownerName: string;
  shopName: string;
  whatsappNumber: string;
  altMobile: string;
  businessType: BusinessType | '';
  city: string;
  tehsil: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  gstNumber: string;
}

const INITIAL_FORM: FormData = {
  ownerName: '',
  shopName: '',
  whatsappNumber: '',
  altMobile: '',
  businessType: '',
  city: '',
  tehsil: '',
  district: '',
  state: '',
  country: 'India',
  pincode: '',
  gstNumber: '',
};

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6E6257', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E4DE',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 14,
  outline: 'none',
  background: '#F8F6F2',
  color: '#1F1813',
  fontFamily: 'inherit',
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [mobile, setMobile] = useState('');

  useEffect(() => {
    const storedMobile = sessionStorage.getItem('mxd_reg_mobile');
    if (!storedMobile) {
      router.push('/auth');
      return;
    }
    setMobile(storedMobile);
  }, [router]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validateStep1(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.ownerName.trim() || form.ownerName.length < 2) newErrors.ownerName = 'Required (min 2 chars)';
    if (!form.shopName.trim() || form.shopName.length < 2) newErrors.shopName = 'Required (min 2 chars)';
    if (!/^[6-9]\d{9}$/.test(form.whatsappNumber)) newErrors.whatsappNumber = 'Enter a valid 10-digit number';
    if (!form.businessType) newErrors.businessType = 'Select a business type' as BusinessType;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.city.trim()) newErrors.city = 'Required';
    if (!form.tehsil.trim()) newErrors.tehsil = 'Required';
    if (!form.district.trim()) newErrors.district = 'Required';
    if (!form.state.trim()) newErrors.state = 'Required';
    if (!/^\d{6}$/.test(form.pincode)) newErrors.pincode = 'Enter a valid 6-digit pincode';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setLoading(true);
    setApiError('');
    try {
      const res = await authApi.register({
        mobile,
        ...form,
        businessType: form.businessType || undefined,
        altMobile: form.altMobile || undefined,
        gstNumber: form.gstNumber || undefined,
      });
      setToken(res.data.token);
      localStorage.setItem('mxd_dealer', JSON.stringify(res.data.dealer));
      sessionStorage.removeItem('mxd_reg_mobile');
      router.push('/catalog');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed. Please try again.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F2', padding: 20 }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Logo height={38} preload />
          </div>
          <div style={{ fontSize: 12, color: '#6E6257', marginTop: 4 }}>Dealer Registration</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    background: i < step ? '#2E7D32' : i === step ? '#F47920' : '#E8E4DE',
                    color: i <= step ? '#fff' : '#6E6257',
                    transition: 'background 0.2s',
                  }}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: i === step ? '#F47920' : '#6E6257', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? '#2E7D32' : '#E8E4DE', margin: '0 8px', marginBottom: 18, transition: 'background 0.2s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 28 }}>
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Business Information</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <FormField label="Owner Name" required>
                    <input
                      style={{ ...inputStyle, borderColor: errors.ownerName ? '#DC2626' : '#E8E4DE' }}
                      value={form.ownerName}
                      onChange={(e) => update('ownerName', e.target.value)}
                      placeholder="Full name"
                    />
                    {errors.ownerName && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.ownerName}</p>}
                  </FormField>

                  <FormField label="Shop Name" required>
                    <input
                      style={{ ...inputStyle, borderColor: errors.shopName ? '#DC2626' : '#E8E4DE' }}
                      value={form.shopName}
                      onChange={(e) => update('shopName', e.target.value)}
                      placeholder="Your shop or business name"
                    />
                    {errors.shopName && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.shopName}</p>}
                  </FormField>

                  <FormField label="WhatsApp Number" required>
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${errors.whatsappNumber ? '#DC2626' : '#E8E4DE'}`, borderRadius: 10, overflow: 'hidden', background: '#F8F6F2' }}>
                      <span style={{ padding: '11px 12px', fontSize: 13, color: '#6E6257', borderRight: '1px solid #E8E4DE' }}>+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={form.whatsappNumber}
                        onChange={(e) => update('whatsappNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit WhatsApp number"
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 12px', fontSize: 14, background: 'transparent' }}
                      />
                    </div>
                    {errors.whatsappNumber && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.whatsappNumber}</p>}
                  </FormField>

                  <FormField label="Alternate Mobile">
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E8E4DE', borderRadius: 10, overflow: 'hidden', background: '#F8F6F2' }}>
                      <span style={{ padding: '11px 12px', fontSize: 13, color: '#6E6257', borderRight: '1px solid #E8E4DE' }}>+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={form.altMobile}
                        onChange={(e) => update('altMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Optional"
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 12px', fontSize: 14, background: 'transparent' }}
                      />
                    </div>
                  </FormField>

                  <FormField label="Business Type" required>
                    <select
                      value={form.businessType}
                      onChange={(e) => update('businessType', e.target.value)}
                      style={{ ...inputStyle, borderColor: errors.businessType ? '#DC2626' : '#E8E4DE', cursor: 'pointer' }}
                    >
                      <option value="">Select business type</option>
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>{bt.label}</option>
                      ))}
                    </select>
                    {errors.businessType && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.businessType}</p>}
                  </FormField>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Location Details</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="City" required>
                      <input style={{ ...inputStyle, borderColor: errors.city ? '#DC2626' : '#E8E4DE' }} value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="City" />
                      {errors.city && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.city}</p>}
                    </FormField>
                    <FormField label="Tehsil" required>
                      <input style={{ ...inputStyle, borderColor: errors.tehsil ? '#DC2626' : '#E8E4DE' }} value={form.tehsil} onChange={(e) => update('tehsil', e.target.value)} placeholder="Tehsil" />
                      {errors.tehsil && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.tehsil}</p>}
                    </FormField>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="District" required>
                      <input style={{ ...inputStyle, borderColor: errors.district ? '#DC2626' : '#E8E4DE' }} value={form.district} onChange={(e) => update('district', e.target.value)} placeholder="District" />
                      {errors.district && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.district}</p>}
                    </FormField>
                    <FormField label="State" required>
                      <select
                        value={form.state}
                        onChange={(e) => update('state', e.target.value)}
                        style={{ ...inputStyle, borderColor: errors.state ? '#DC2626' : '#E8E4DE', cursor: 'pointer' }}
                      >
                        <option value="">Select state</option>
                        <optgroup label="Service Area">
                          {INDIAN_STATES.filter((s) => SERVED_STATES.has(s)).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Other States (service not available)">
                          {INDIAN_STATES.filter((s) => !SERVED_STATES.has(s)).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </optgroup>
                      </select>
                      {errors.state && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.state}</p>}
                    </FormField>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Country" required>
                      <input style={inputStyle} value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="Country" />
                    </FormField>
                    <FormField label="Pincode" required>
                      <input
                        style={{ ...inputStyle, borderColor: errors.pincode ? '#DC2626' : '#E8E4DE' }}
                        value={form.pincode}
                        onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit pincode"
                        maxLength={6}
                      />
                      {errors.pincode && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{errors.pincode}</p>}
                    </FormField>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Review & Submit</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {/* Summary */}
                  {[
                    { label: 'Mobile', value: `+91 ${mobile}` },
                    { label: 'Owner', value: form.ownerName },
                    { label: 'Shop', value: form.shopName },
                    { label: 'WhatsApp', value: `+91 ${form.whatsappNumber}` },
                    { label: 'Business Type', value: BUSINESS_TYPES.find((b) => b.value === form.businessType)?.label || '' },
                    { label: 'City', value: form.city },
                    { label: 'District', value: form.district },
                    { label: 'State', value: form.state },
                    { label: 'Pincode', value: form.pincode },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F8F6F2', paddingBottom: 8 }}>
                      <span style={{ color: '#6E6257' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: '#1F1813' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <FormField label="GST Number (Optional)">
                  <input
                    style={inputStyle}
                    value={form.gstNumber}
                    onChange={(e) => update('gstNumber', e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN"
                    maxLength={15}
                  />
                </FormField>

                {apiError && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#FCE7E7', borderRadius: 8, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
                    {apiError}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep((s) => s - 1)}
                style={{ padding: '12px 20px', fontSize: 14 }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="btn-orange"
                onClick={handleNext}
                style={{ flex: 1, padding: '12px', fontSize: 14 }}
              >
                Next Step <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="btn-orange"
                onClick={handleSubmit}
                disabled={loading}
                style={{ flex: 1, padding: '12px', fontSize: 14 }}
              >
                {loading ? 'Creating Account...' : 'Submit Registration'}
                {!loading && <Check size={15} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
