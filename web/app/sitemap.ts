/**
 * sitemap.xml generator (Next.js Metadata Route). Emits the static public pages
 * plus a dynamic entry per product fetched from the API, so search engines can
 * discover the catalog. Falls back to localhost when NEXT_PUBLIC_API_URL is unset.
 */
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const BASE_URL = SITE_URL;
const API_URL = process.env.INTERNAL_API_URL
  ? `${process.env.INTERNAL_API_URL.replace(/\/$/, '')}/api`
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/catalog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const products = await fetchAllProducts();
  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/product/${encodeURIComponent(p.sku)}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  return [...staticPages, ...productPages];
}

/** The products API serves at most this many per page (it rejects more with a 400). */
const PAGE_SIZE = 100;

/** Every visible product, page by page; whatever loaded if a page fails. */
async function fetchAllProducts(): Promise<Array<{ sku: string; updatedAt: string }>> {
  const all: Array<{ sku: string; updatedAt: string }> = [];
  try {
    for (let page = 1; page <= 100; page++) {
      const res = await fetch(`${API_URL}/products?limit=${PAGE_SIZE}&page=${page}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = await res.json();
      const batch: Array<{ sku: string; updatedAt: string }> = json.data || [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE || page >= (json.pagination?.pages ?? page)) break;
    }
  } catch {
    /* the sitemap still lists the fixed pages and what loaded */
  }
  return all;
}
