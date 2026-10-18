'use client';

/**
 * AuthProvider — the dealer's signed-in state for the whole storefront. Mounted
 * once in the root layout. On load it asks GET /api/auth/me whether the session
 * cookie is still good (401 = signed out); the login and registration pages call
 * signIn() with the dealer the API returned, and logout() ends the session on
 * the API, which clears the httpOnly cookie. Read it through useAuth().
 *
 * Admin pages have their own login, so the check is skipped there.
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { authApi, clearLegacySession, type SessionDealer } from '@/lib/api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  /** The signed-in dealer, or null. */
  user: SessionDealer | null;
  status: AuthStatus;
  isLoggedIn: boolean;
  /** True until the first session check answers. */
  loading: boolean;
  /** Record a dealer the API has just signed in (it has already set the cookie). */
  signIn: (dealer: SessionDealer) => void;
  /** Ask the API who is signed in. */
  refresh: () => Promise<void>;
  /** End the session and go to the login page. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  const [user, setUser] = useState<SessionDealer | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const checked = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data.dealer);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    if (isAdmin || checked.current) return;
    checked.current = true;
    try {
      clearLegacySession();
    } catch {
      /* storage blocked: nothing to clean up */
    }
    void refresh();
  }, [isAdmin, refresh]);

  const signIn = useCallback((dealer: SessionDealer) => {
    checked.current = true;
    setUser(dealer);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the cookie expires on its own; still leave the signed-in screens */
    }
    setUser(null);
    setStatus('anonymous');
    // A full load drops every per-dealer bit of state (cart counts, prices).
    window.location.assign('/auth');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isLoggedIn: status === 'authenticated',
      loading: status === 'loading',
      signIn,
      refresh,
      logout,
    }),
    [user, status, signIn, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
