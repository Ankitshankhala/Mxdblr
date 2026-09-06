/**
 * Root layout — wraps every route. Loads the Inter font, imports global styles,
 * sets the site-wide <Metadata> defaults, and mounts the persistent
 * FloatingWhatsApp CTA. The single <html>/<body> shell for the whole app.
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FloatingWhatsApp from "@/components/layout/FloatingWhatsApp";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mxdblr.com'),
  title: {
    default: 'MXD® — B2B Wholesale Mobile Accessories',
    template: '%s | MXD® Wholesale',
  },
  description: 'Wholesale mobile accessories for registered dealers in Karnataka, Tamil Nadu & Andhra Pradesh. Bulk pricing on chargers, cables, cases, earphones and more.',
  keywords: ['wholesale mobile accessories', 'B2B dealer portal', 'bulk mobile accessories Karnataka', 'chargers wholesale', 'cables wholesale', 'Bengaluru mobile accessories distributor'],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://www.mxdblr.com',
    siteName: 'MXD Wholesale',
    title: 'MXD® — B2B Wholesale Mobile Accessories',
    description: 'Wholesale mobile accessories for registered dealers across South India.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MXD® Wholesale — B2B Mobile Accessories',
    description: 'Wholesale mobile accessories for registered dealers in South India.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // suppressHydrationWarning on <html> and <body>: browser extensions inject
  // attributes onto these two elements before React hydrates (e.g.
  // data-toolzbuy-ext="1"), which the server HTML cannot know about and which
  // React would otherwise report as a hydration mismatch. The flag is one level
  // deep — it only covers these elements' own attributes, so genuine mismatches
  // inside the app are still reported.
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
        <FloatingWhatsApp />
      </body>
    </html>
  );
}
