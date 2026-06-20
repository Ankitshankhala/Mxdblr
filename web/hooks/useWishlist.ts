'use client';

/**
 * useWishlist — localStorage-backed wishlist of product IDs (key: mxd_wishlist).
 * Exposes the saved IDs plus add/remove/toggle/has helpers. Client-only; not
 * synced to the server.
 */
import { useState, useEffect, useCallback } from 'react';

const WISHLIST_KEY = 'mxd_wishlist';

export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_KEY);
      setWishlistIds(stored ? JSON.parse(stored) : []);
    } catch {
      setWishlistIds([]);
    }
  }, []);

  const toggle = useCallback((productId: string) => {
    setWishlistIds(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  return { wishlistIds, toggle, isWishlisted };
}
