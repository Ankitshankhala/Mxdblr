/**
 * The site's one canonical address, without a trailing slash. Metadata
 * (metadataBase, canonical tags, og:url), sitemap.xml, robots.txt and the
 * www <-> bare-domain redirect in next.config.ts all derive from it.
 *
 * Set NEXT_PUBLIC_SITE_URL to change it (e.g. https://www.mxdblr.com to make www
 * the primary); it is read at build time, so rebuild after changing it.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mxdblr.com').replace(/\/+$/, '');

/**
 * Site-wide Open Graph defaults (the root layout's). They carry no og:url, so a
 * page never claims to be another page; the homepage adds url '/' to these, and
 * pages with their own share text set their own url.
 */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  locale: 'en_IN',
  siteName: 'MXD Wholesale',
  title: 'MXD® — B2B Wholesale Mobile Accessories',
  description: 'Wholesale mobile accessories for registered dealers across South India.',
} as const;
