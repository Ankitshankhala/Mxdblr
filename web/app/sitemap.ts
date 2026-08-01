/**
 * sitemap.xml generator (Next.js Metadata Route). Emits the static public pages
 * plus a dynamic entry per product fetched from the API, so search engines can
 * discover the catalog. Falls back to localhost when NEXT_PUBLIC_API_URL is unset.
 */
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.mxdblr.com';
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

  try {
    const res = await fetch(`${API_URL}/products?limit=500&page=1`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return staticPages;
    const json = await res.json();
    const products: Array<{ sku: string; updatedAt: string }> = json.data || json.products || [];
    const productPages: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${BASE_URL}/product/${p.sku}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    return [...staticPages, ...productPages];
  } catch {
    return staticPages;
  }
}
