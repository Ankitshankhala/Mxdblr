'use client';

/**
 * useAuth — dealer session hook. Exposes the current dealer (decoded/stored from
 * the JWT), authentication state, and logout (clears the token). Used by
 * storefront pages to gate dealer-only UI and redirect to /auth.
 */
import { useState, useEffect } from 'react';
import { clearToken } from '@/lib/api';

interface AuthDealer {
  id: string;
  ownerName: string;
  shopName: string;
  mobile: string;
  status: string;
}

export function useAuth() {
  const [dealer, setDealer] = useState<AuthDealer | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mxd_token');
    const storedDealer = localStorage.getItem('mxd_dealer');

    if (token && storedDealer) {
      try {
        // Decode payload to check expiry. Cryptographic verification happens
        // server-side on every API call — this is a UX guard only.
        const [, payloadB64] = token.split('.');
        const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json) as { exp?: number; type?: string };

        const isExpired = payload.exp !== undefined && payload.exp * 1000 < Date.now();
        const isDealerToken = payload.type === 'dealer';

        if (isExpired || !isDealerToken) {
          clearToken();
        } else {
          setDealer(JSON.parse(storedDealer));
          setIsAuthenticated(true);
        }
      } catch {
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  const login = (token: string, dealerData: AuthDealer) => {
    localStorage.setItem('mxd_token', token);
    localStorage.setItem('mxd_dealer', JSON.stringify(dealerData));
    setDealer(dealerData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearToken();
    setDealer(null);
    setIsAuthenticated(false);
    window.location.href = '/auth';
  };

  return { dealer, isAuthenticated, loading, login, logout };
}
