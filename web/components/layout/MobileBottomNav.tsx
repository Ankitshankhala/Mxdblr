'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid3X3, ShoppingBag, Heart, User } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

const BASE_NAV = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/catalog', label: 'Catalog', Icon: Grid3X3 },
  { href: '/cart', label: 'Cart', Icon: ShoppingBag },
  { href: '/wishlist', label: 'Wishlist', Icon: Heart },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const [accountHref, setAccountHref] = useState('/auth');

  useEffect(() => {
    const token = localStorage.getItem('dealerToken') || localStorage.getItem('mxd_token');
    setAccountHref(token ? '/account' : '/auth');
  }, []);

  const NAV_ITEMS = [...BASE_NAV, { href: accountHref, label: 'Account', Icon: User }];

  return (
    <nav
      className="flex desktop:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #E8E4DE',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        const isCart = href === '/cart';

        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 4px',
              textDecoration: 'none',
              color: isActive ? '#F47920' : '#A8A39A',
              position: 'relative',
            }}
          >
            <span style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              {isCart && count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    background: '#F47920',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 15,
                    height: 15,
                    fontSize: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
