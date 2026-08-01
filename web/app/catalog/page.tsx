/**
 * Catalog browse page (route: /catalog).
 *
 * Server Component: reads brand/category/search/sort/page from the URL, fetches
 * the matching products + category tree on the server (ISR, revalidate 60s), and
 * renders the initial HTML server-side for SEO/perf. All interactivity lives in
 * the client CatalogView, which is fully URL-driven — every filter/sort/page
 * change navigates, re-running this fetch. SEO metadata is in catalog/layout.tsx.
 * (Converted from the previous fully client-rendered implementation.)
 */
import CatalogView from '@/components/products/CatalogView';
import type { FilterValues } from '@/components/products/FilterSidebar';
import type { Product, Category } from '@/types';

// Server-side fetches run inside the container/host, not the browser, so prefer
// INTERNAL_API_URL (Docker service name) when set; fall back to the public URL.
const API = process.env.INTERNAL_API_URL
  ? `${process.env.INTERNAL_API_URL.replace(/\/$/, '')}/api`
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');
const LIMIT = 24;

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

async function getCatalogData(sp: SearchParams): Promise<{
  products: Product[];
  total: number;
  categories: Category[];
}> {
  const category = first(sp.category);
  const brand = first(sp.brand);
  const stockStatus = first(sp.stockStatus);
  const search = first(sp.search);
  const sort = first(sp.sort) || 'newest';
  const pageNum = Math.max(1, parseInt(first(sp.page)) || 1);

  const params = new URLSearchParams();
  params.set('page', String(pageNum));
  params.set('limit', String(LIMIT));
  params.set('sort', sort);
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  if (stockStatus) params.set('stockStatus', stockStatus);
  if (search) params.set('search', search);

  const [productsRes, categoriesRes] = await Promise.allSettled([
    fetch(`${API}/products?${params.toString()}`, { next: { revalidate: 60 } }).then((r) => r.json()),
    fetch(`${API}/categories`, { next: { revalidate: 60 } }).then((r) => r.json()),
  ]);

  const products: Product[] =
    productsRes.status === 'fulfilled' ? (productsRes.value?.data ?? []) : [];
  const total: number =
    productsRes.status === 'fulfilled' ? (productsRes.value?.pagination?.total ?? 0) : 0;
  const categories: Category[] =
    categoriesRes.status === 'fulfilled' ? (categoriesRes.value?.data ?? []) : [];

  return { products, total, categories };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { products, total, categories } = await getCatalogData(sp);

  const search = first(sp.search);
  const sort = first(sp.sort) || 'newest';
  const page = Math.max(1, parseInt(first(sp.page)) || 1);
  const rawStock = first(sp.stockStatus);
  const stockStatus: FilterValues['stockStatus'] =
    rawStock === 'IN_STOCK' || rawStock === 'LOW_STOCK' || rawStock === 'OUT_OF_STOCK'
      ? rawStock
      : '';
  const filters: FilterValues = {
    brands: first(sp.brand) ? [first(sp.brand)] : [],
    stockStatus,
    categorySlug: first(sp.category),
  };

  return (
    <CatalogView
      products={products}
      total={total}
      categories={categories}
      page={page}
      sort={sort}
      search={search}
      filters={filters}
    />
  );
}
