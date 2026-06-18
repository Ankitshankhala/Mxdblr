import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wholesale Mobile Accessories Catalog',
  description: 'Browse our full catalog of wholesale mobile accessories — chargers, cables, earphones, cases, power banks and more. Bulk pricing for registered dealers in South India.',
  openGraph: {
    title: 'Wholesale Mobile Accessories Catalog | MXD®',
    description: 'Full wholesale catalog — chargers, cables, earphones, cases, power banks. B2B dealer portal.',
  },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
