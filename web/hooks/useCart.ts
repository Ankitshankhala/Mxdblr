'use client';

/**
 * useCart — dealer cart state hook. Loads the cart from the API and wraps
 * add/update/remove/clear, each returning { success, message } and preserving
 * local state on failure so the UI can surface a toast. Backs the cart page and
 * the add-to-cart buttons.
 */
import { useState, useEffect, useCallback } from 'react';
import { cartApi } from '@/lib/api';
import type { CartItem } from '@/types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mxd_token') : null;
    if (!token) return;

    setLoading(true);
    try {
      const res = await cartApi.get();
      setItems(res.data.data);
      setError(null);
    } catch {
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (productId: string, quantity: number) => {
    try {
      await cartApi.addOrUpdate(productId, quantity);
      await fetchCart();
      return { success: true };
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to add to cart';
      return { success: false, message };
    }
  }, [fetchCart]);

  const removeFromCart = useCallback(async (productId: string) => {
    try {
      await cartApi.remove(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return { success: true };
    } catch {
      return { success: false, message: 'Failed to remove item' };
    }
  }, []);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      await cartApi.addOrUpdate(productId, quantity);
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
      );
      return { success: true };
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update quantity';
      return { success: false, message };
    }
  }, []);

  const clearCart = useCallback(async () => {
    try {
      await cartApi.clear();
      setItems([]);
      return { success: true };
    } catch {
      // Keep local state — server cart was not cleared
      return { success: false, message: 'Failed to clear cart. Please try again.' };
    }
  }, []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, loading, error, count, addToCart, removeFromCart, updateQuantity, clearCart, refetch: fetchCart };
}
