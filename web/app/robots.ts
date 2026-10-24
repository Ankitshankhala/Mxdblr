/**
 * robots.txt generator (Next.js Metadata Route). Allows crawling of public
 * pages (home, catalog, product, register) and disallows private areas
 * (/admin, /account, /cart, /auth, /api). Points crawlers at the sitemap.
 */
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/catalog', '/product/', '/register'],
        disallow: ['/admin/', '/account/', '/cart', '/auth', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
