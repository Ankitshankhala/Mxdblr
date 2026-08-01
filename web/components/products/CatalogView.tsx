'use client';

/**
 * CatalogView — client interactivity shell for the catalog route.
 *
 * Receives the server-fetched products, total, and category tree as props
 * (initial render is SSR HTML — good for SEO/perf). All filter/sort/page changes
 * are URL-driven: they call router.push with updated query params, which re-runs
 * the server component and streams new props back. This component holds NO data
 * fetching of its own — only local UI state (the mobile filter sheet).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import ProductGrid from '@/components/products/ProductGrid';
import FilterSidebar, { type FilterValues } from '@/components/products/FilterSidebar';
import type { Product, Category } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Latest' },
  { value: 'name_asc', label: 'A–Z' },
  { value: 'name_desc', label: 'Z–A' },
  { value: 'oldest', label: 'Oldest' },
];

const LIMIT = 24;

interface CatalogViewProps {
  products: Product[];
  total: number;
  categories: Category[];
  page: number;
  sort: string;
  search: string;
  filters: FilterValues;
}

export default function CatalogView({
  products,
  total,
  categories,
  page,
  sort,
  search,
  filters,
}: CatalogViewProps) {
  const router = useRouter();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Build a /catalog URL from a partial set of query changes, dropping empties.
  // Any change that isn't an explicit page change resets to page 1.
  function buildUrl(next: Partial<{ category: string; brand: string; stockStatus: string; search: string; sort: string; page: number }>) {
    const params = new URLSearchParams();
    const category = next.category ?? filters.categorySlug;
    const brand = next.brand ?? (filters.brands[0] || '');
    const stockStatus = next.stockStatus ?? filters.stockStatus;
    const searchVal = next.search ?? search;
    const sortVal = next.sort ?? sort;
    const pageVal = next.page ?? 1;

    if (category) params.set('category', category);
    if (brand) params.set('brand', brand);
    if (stockStatus) params.set('stockStatus', stockStatus);
    if (searchVal) params.set('search', searchVal);
    if (sortVal && sortVal !== 'newest') params.set('sort', sortVal);
    if (pageVal > 1) params.set('page', String(pageVal));

    const qs = params.toString();
    return qs ? `/catalog?${qs}` : '/catalog';
  }

  function handleApplyFilters(newFilters: FilterValues) {
    router.push(buildUrl({
      category: newFilters.categorySlug,
      brand: newFilters.brands[0] || '',
      stockStatus: newFilters.stockStatus,
      page: 1,
    }));
    setShowMobileFilters(false);
  }

  function handleSearch(query: string) {
    router.push(buildUrl({ search: query, page: 1 }));
  }

  const totalPages = Math.ceil(total / LIMIT);

  function getPageNumbers(current: number, totalPg: number): (number | '...')[] {
    if (totalPg <= 7) return Array.from({ length: totalPg }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPg - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < totalPg - 2) pages.push('...');
    pages.push(totalPg);
    return pages;
  }

  const currentCategoryName = categories.find((c) => c.slug === filters.categorySlug)?.name;

  return (
    <div className="page-safe-bottom" style={{ minHeight: '100vh', background: '#F8F6F2' }}>
      <Navbar onSearch={handleSearch} initialSearch={search} />
      <MobileBottomNav />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 20px' }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6B7D', marginBottom: 20 }}>
          <Link href="/" style={{ color: '#6B6B7D', textDecoration: 'none' }}>Home</Link>
          <ChevronRight size={12} />
          <Link href="/catalog" style={{ color: '#6B6B7D', textDecoration: 'none' }}>Catalog</Link>
          {currentCategoryName && (
            <>
              <ChevronRight size={12} />
              <span style={{ color: '#1A1A2E', fontWeight: 600 }}>{currentCategoryName}</span>
            </>
          )}
        </nav>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 20 }}>
              {currentCategoryName || (search ? `Search: "${search}"` : 'All Products')}
            </h1>
            <p style={{ fontSize: 13, color: '#6B6B7D', marginTop: 2 }}>
              {`${total.toLocaleString()} products`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Sort */}
            <div className="catalog-sort-bar">
              <ArrowUpDown size={14} color="#6B6B7D" />
              <select
                value={sort}
                onChange={(e) => router.push(buildUrl({ sort: e.target.value, page: 1 }))}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid #E8E4DE',
                  borderRadius: 8,
                  padding: '6px 10px',
                  background: '#fff',
                  cursor: 'pointer',
                  color: '#1A1A2E',
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Mobile filter button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="btn-ghost catalog-mobile-filter-btn"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Layout: sidebar + grid */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Desktop sidebar */}
          <div className="catalog-filter-sidebar">
            <FilterSidebar
              categories={categories}
              filters={filters}
              onApply={handleApplyFilters}
            />
          </div>

          {/* Product grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ProductGrid products={products} loading={false} columns={3} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page <= 1}
                  onClick={() => router.push(buildUrl({ page: page - 1 }))}
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  Previous
                </button>
                {getPageNumbers(page, totalPages).map((item, idx) =>
                  item === '...' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{
                        width: 36,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#6B6B7D',
                        userSelect: 'none',
                      }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => router.push(buildUrl({ page: item as number }))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: 'none',
                        background: page === item ? '#F47920' : '#fff',
                        color: page === item ? '#fff' : '#1A1A2E',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => router.push(buildUrl({ page: page + 1 }))}
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {showMobileFilters && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 49,
            }}
            onClick={() => setShowMobileFilters(false)}
          />
          <FilterSidebar
            categories={categories}
            filters={filters}
            onApply={handleApplyFilters}
            onClose={() => setShowMobileFilters(false)}
            isMobile
          />
        </>
      )}
    </div>
  );
}
