import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MXD Wholesale Portal — B2B Mobile Accessories',
      },
    ],
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
  return (
    <html lang="en-IN" className={inter.variable}>
      <body className="min-h-screen" suppressHydrationWarning>{children}</body>
    </html>
  );
}
