/**
 * Register route layout. A Server Component whose only job is to export the
 * page's canonical URL — the registration page itself is a Client Component and
 * can't export metadata.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/register' },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
