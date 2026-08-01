'use client';

/**
 * Navbar — top navigation for the public/dealer site: logo, catalog/search,
 * cart, and auth-aware account menu (reads the dealer token). Persistent across
 * storefront pages.
 */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface NavCategory { id: string; name: string; slug: string; }

interface NavbarProps {
  onSearch?: (query: string) => void;
  initialSearch?: string;
}

export default function Navbar({ onSearch, initialSearch = '' }: NavbarProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState('');
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchValue, setMobileSearchValue] = useState('');
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync input with URL search param
  useEffect(() => {
    setSearchValue(initialSearch);
  }, [initialSearch]);

  // Focus mobile input when overlay opens
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [mobileSearchOpen]);

  // Check auth state on mount
  useEffect(() => {
    const token = localStorage.getItem('dealerToken') || localStorage.getItem('mxd_token');
    setIsLoggedIn(!!token);
  }, []);

  const { count } = useCart();

  useEffect(() => {
    fetch(`${API}/categories`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) {
          const flat: NavCategory[] = [];
          function flatten(nodes: any[]) {
            nodes.forEach((n: any) => {
              if (n.active !== false) flat.push({ id: n.id, name: n.name, slug: n.slug });
              if (n.children?.length) flatten(n.children);
            });
          }
          flatten(d.data);
          setCategories(flat);
        }
      })
      .catch(() => {});
  }, []);

  // Navigate to catalog with search query, or call onSearch if provided (catalog page)
  const fireSearch = (query: string) => {
    if (onSearch) {
      onSearch(query);
    } else {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      router.push(`/catalog${query ? `?${params.toString()}` : ''}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    clearTimeout(searchTimer.current);
    fireSearch(searchValue);
  };

  const handleInputChange = (val: string) => {
    setSearchValue(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fireSearch(val);
    }, 400);
  };

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSearchValue.trim()) return;
    setMobileSearchOpen(false);
    const params = new URLSearchParams();
    params.set('search', mobileSearchValue.trim());
    router.push(`/catalog?${params.toString()}`);
  };

  return (
    <header
      style={{
        background: '#1A1A2E',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      {/* Main navbar row */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 20px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: '#F47920', letterSpacing: '-0.5px' }}>
              MXD®
            </span>
            <span style={{ fontSize: 9, color: '#6B6B7D', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Wholesale Portal
            </span>
          </div>
        </Link>

        {/* Search bar — hidden on mobile */}
        <form onSubmit={handleSearch} style={{ flex: 1, position: 'relative' }} className="hidden md:block">
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#A8A39A',
            }}
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search products, SKUs, brands..."
            style={{
              width: '100%',
              height: 38,
              background: '#fff',
              border: 'none',
              borderRadius: 10,
              paddingLeft: 38,
              paddingRight: searchValue ? 38 : 14,
              fontSize: 14,
              outline: 'none',
              color: '#1A1A2E',
            }}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => { clearTimeout(searchTimer.current); setSearchValue(''); if (onSearch) onSearch(''); }}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#A8A39A',
              }}
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Right actions — marginLeft:auto pins this to the right edge on mobile,
            where the flex:1 search bar is hidden and no longer pushes it over. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
          {/* Mobile search icon */}
          <button
            type="button"
            className="md:hidden"
            onClick={() => { setMobileSearchOpen(true); setMobileSearchValue(''); }}
            style={{
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#E8E4DE',
              borderRadius: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Search size={20} />
          </button>

          {/* Cart */}
          <Link
            href="/cart"
            style={{
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#E8E4DE',
              position: 'relative',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            <ShoppingBag size={20} />
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: '#F47920',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          {/* Register CTA — logged-out visitors only. The primary conversion
              goal of this site is dealer registration, so it needs a named,
              visible action in the persistent nav rather than only the
              generic account icon (CRO review recommendation). */}
          {!isLoggedIn && (
            <Link
              href="/register"
              className="hidden md:inline-flex"
              style={{
                alignItems: 'center',
                gap: 6,
                background: '#F47920',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                marginLeft: 4,
              }}
            >
              Register as a Dealer
            </Link>
          )}

          {/* Account */}
          <Link
            href={isLoggedIn ? '/account' : '/auth'}
            style={{
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLoggedIn ? '#F47920' : '#E8E4DE',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            <User size={20} />
          </Link>
        </div>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setMobileSearchOpen(false)}
        >
          <div
            style={{ background: '#1A1A2E', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleMobileSearch} style={{ flex: 1, position: 'relative' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A8A39A' }}
              />
              <input
                ref={mobileInputRef}
                type="search"
                value={mobileSearchValue}
                onChange={(e) => setMobileSearchValue(e.target.value)}
                placeholder="Search products, SKUs, brands..."
                style={{
                  width: '100%',
                  height: 42,
                  background: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  paddingLeft: 36,
                  paddingRight: mobileSearchValue ? 36 : 14,
                  fontSize: 15,
                  outline: 'none',
                  color: '#1A1A2E',
                }}
              />
              {mobileSearchValue && (
                <button
                  type="button"
                  onClick={() => setMobileSearchValue('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A8A39A' }}
                >
                  <X size={14} />
                </button>
              )}
            </form>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              style={{ color: '#A8A39A', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, flexShrink: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category pills — desktop only */}
      <div
        className="hidden md:flex"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '0 20px',
          gap: 4,
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        {/* All */}
        <Link
          href="/catalog"
          onClick={() => setActiveCategory('')}
          style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: '6px 6px 0 0', color: activeCategory === '' ? '#F47920' : '#A8A39A', background: activeCategory === '' ? 'rgba(244,121,32,0.1)' : 'transparent', borderBottom: activeCategory === '' ? '2px solid #F47920' : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s' }}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/catalog?category=${cat.slug}`}
            onClick={() => setActiveCategory(cat.slug)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: '6px 6px 0 0',
              color: activeCategory === cat.slug ? '#F47920' : '#A8A39A',
              background: activeCategory === cat.slug ? 'rgba(244,121,32,0.1)' : 'transparent',
              borderBottom: activeCategory === cat.slug ? '2px solid #F47920' : '2px solid transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </header>
  );
}
