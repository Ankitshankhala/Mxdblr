import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/catalog', '/product/', '/register'],
        disallow: ['/admin/', '/account/', '/cart', '/auth', '/api/'],
      },
    ],
    sitemap: 'https://www.mxdblr.com/sitemap.xml',
    host: 'https://www.mxdblr.com',
  };
}
