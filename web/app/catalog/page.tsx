'use client';

/**
 * Catalog browse page (route: /catalog). Reads brand/category/search/sort/page
 * from the URL search params and fetches matching products from the API, with a
 * filter sidebar and grid. SEO metadata is supplied by the sibling server
 * catalog/layout.tsx. NOTE: currently fully client-rendered — flagged in the
 * production audit for conversion to a Server Component (perf/SEO).
 */
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import ProductGrid from '@/components/products/ProductGrid';
import FilterSidebar, { type FilterValues } from '@/components/products/FilterSidebar';
import { productsApi, categoriesApi } from '@/lib/api';
import type { Product, Category } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Latest' },
  { value: 'name_asc', label: 'A–Z' },
  { value: 'name_desc', label: 'Z–A' },
  { value: 'oldest', label: 'Oldest' },
];

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [filters, setFilters] = useState<FilterValues>({
    brands: searchParams.get('brand') ? [searchParams.get('brand')!] : [],
    stockStatus: '',
    categorySlug: searchParams.get('category') || '',
  });

  const search = searchParams.get('search') || '';
  const limit = 24;

  // Re-sync filters whenever the URL changes (e.g. clicking a category in the navbar)
  useEffect(() => {
    setFilters({
      brands: searchParams.get('brand') ? [searchParams.get('brand')!] : [],
      stockStatus: '',
      categorySlug: searchParams.get('category') || '',
    });
    setPage(1);
  }, [searchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters.categorySlug) params.category = filters.categorySlug;
      if (filters.brands.length === 1) params.brand = filters.brands[0];
      if (filters.stockStatus) params.stockStatus = filters.stockStatus;
      if (search) params.search = search;
      params.sort = sort;

      const res = await productsApi.list(params);
      setProducts(res.data.data);
      setTotal(res.data.pagination.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, search, sort]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    categoriesApi.tree()
      .then((res) => setCategories(res.data.data))
      .catch(() => {});
  }, []);

  function handleApplyFilters(newFilters: FilterValues) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleSearch(query: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set('search', query);
    else params.delete('search');
    router.push(`/catalog?${params.toString()}`);
  }

  const totalPages = Math.ceil(total / limit);

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

  // Current category name for breadcrumb
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
              {loading ? 'Loading...' : `${total.toLocaleString()} products`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Sort */}
            <div className="catalog-sort-bar">
              <ArrowUpDown size={14} color="#6B6B7D" />
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
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
            <ProductGrid products={products} loading={loading} columns={3} />

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
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
                      onClick={() => setPage(item as number)}
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
                  onClick={() => setPage((p) => p + 1)}
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

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogContent />
    </Suspense>
  );
}
