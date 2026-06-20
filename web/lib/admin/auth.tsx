"use client";

/**
 * Admin auth/permission context for the frontend. Provides the signed-in admin's
 * identity and permission set (from GET /api/admin/me) plus helpers to gate menu
 * items and routes by permission. Mirrors the server permission catalog; the
 * real enforcement is server-side — this only drives what the UI shows.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type Permission =
  | "VIEW_DASHBOARD"
  | "MANAGE_PRODUCTS"
  | "MANAGE_INVENTORY"
  | "CREATE_ORDERS"
  | "EDIT_ORDERS"
  | "VIEW_REPORTS"
  | "MANAGE_STAFF"
  | "MANAGE_CUSTOMERS"
  | "ACCESS_FINANCIAL_DATA"
  | "SYSTEM_SETTINGS"
  | "MANAGE_ROLES"
  | "MANAGE_ADMINS";

export interface Me {
  id: string;
  username: string;
  role: { id: string; name: string; rank: number } | null;
  permissions: Permission[];
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  document.cookie = "adminToken=; path=/; max-age=0";
}

/**
 * Authenticated fetch against the admin API. Attaches the bearer token, sets JSON
 * content-type for bodies, and on a 401 clears the session and bounces to login.
 * NOTE: this is convenience only — real authorization is enforced server-side.
 */
export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    clearAdminSession();
    window.location.href = "/admin/login";
  }
  return res;
}

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  error: string | null;
  has: (permission: Permission) => boolean;
  hasAny: (...permissions: Permission[]) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  error: null,
  has: () => false,
  hasAny: () => false,
  refresh: async () => {},
});

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch("/admin/me");
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      const json = await res.json();
      setMe(json.data as Me);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load permissions");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => {
    const permSet = new Set<Permission>(me?.permissions ?? []);
    return {
      me,
      loading,
      error,
      has: (permission) => permSet.has(permission),
      hasAny: (...permissions) => permissions.some((p) => permSet.has(p)),
      refresh,
    };
  }, [me, loading, error, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  return useContext(AuthContext);
}
