'use client';

/**
 * FilterSidebar — catalog filter controls (brand, category, stock status). Emits
 * a FilterValues object to the catalog page, which reflects it into the URL.
 * Doubles as a slide-over panel on mobile.
 */
import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { Category, StockStatus } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface FilterValues {
  brands: string[];
  stockStatus: StockStatus | '';
  categorySlug: string;
}

interface FilterSidebarProps {
  categories: Category[];
  filters: FilterValues;
  onApply: (filters: FilterValues) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ borderBottom: '1px solid #E8E4DE', paddingBottom: 16, marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '0 0 10px',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 13,
          color: '#1A1A2E',
          letterSpacing: '0.02em',
        }}
      >
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && children}
    </div>
  );
}

export default function FilterSidebar({ categories, filters, onApply, onClose, isMobile = false }: FilterSidebarProps) {
  const [local, setLocal] = useState<FilterValues>(filters);
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/brands`)
      .then((r) => r.json())
      .then((d) => { if (d.data?.length) setBrands(d.data.map((b: { name: string }) => b.name)); })
      .catch(() => {});
  }, []);

  function toggleBrand(brand: string) {
    setLocal((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  }

  function handleApply() {
    onApply(local);
    if (onClose) onClose();
  }

  function handleClear() {
    const cleared: FilterValues = { brands: [], stockStatus: '', categorySlug: '' };
    setLocal(cleared);
    onApply(cleared);
    if (onClose) onClose();
  }

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        zIndex: 50,
        padding: 20,
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
      }
    : {
        width: 240,
        flexShrink: 0,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E8E4DE',
        padding: 16,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 80,
      };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <SlidersHorizontal size={15} />
          Filters
        </div>
        {onClose && (
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Category */}
      <Section title="Category">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="radio"
              name="category"
              checked={local.categorySlug === ''}
              onChange={() => setLocal((p) => ({ ...p, categorySlug: '' }))}
            />
            All Categories
          </label>
          {categories.map((cat) => (
            <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="radio"
                name="category"
                checked={local.categorySlug === cat.slug}
                onChange={() => setLocal((p) => ({ ...p, categorySlug: cat.slug }))}
              />
              {cat.name}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A8A39A' }}>{cat.productCount}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Availability */}
      <Section title="Availability">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { value: '', label: 'All' },
            { value: 'IN_STOCK', label: 'In Stock' },
            { value: 'LOW_STOCK', label: 'Low Stock' },
            { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
          ].map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="radio"
                name="stock"
                checked={local.stockStatus === opt.value}
                onChange={() => setLocal((p) => ({ ...p, stockStatus: opt.value as StockStatus | '' }))}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Section>

      {/* Brand */}
      <Section title="Compatible Brand">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {brands.length === 0 ? (
            <span style={{ fontSize: 12, color: '#A8A39A' }}>No brands added yet</span>
          ) : (
            brands.map((brand) => (
              <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={local.brands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                />
                {brand}
              </label>
            ))
          )}
        </div>
      </Section>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="btn-orange"
          style={{ width: '100%', padding: '11px 16px', fontSize: 14 }}
          onClick={handleApply}
        >
          Apply Filters
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ width: '100%', padding: '11px 16px', fontSize: 14, justifyContent: 'center' }}
          onClick={handleClear}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
