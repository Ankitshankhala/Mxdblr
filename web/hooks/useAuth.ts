'use client';

/**
 * useAuth — the dealer session: user, isLoggedIn, loading, signIn, refresh and
 * logout. Backed by AuthProvider (components/auth/AuthProvider.tsx), which checks
 * the httpOnly session cookie with GET /api/auth/me when the site loads.
 */
import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/components/auth/AuthProvider';

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider> (app/layout.tsx).');
  return value;
}
