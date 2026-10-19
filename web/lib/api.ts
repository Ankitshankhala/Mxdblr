/**
 * Frontend API client — the single axios layer the storefront uses to talk to
 * the backend. Centralizes the base URL (NEXT_PUBLIC_API_URL) and grouped
 * endpoint helpers (productsApi, categoriesApi, cartApi, …). Components should
 * call these helpers rather than hit fetch/axios directly.
 *
 * The dealer session is an httpOnly cookie the API sets at login (mxd_session);
 * page scripts never see the token. Requests carry it via withCredentials, and
 * the signed-in state lives in useAuth (components/auth/AuthProvider.tsx).
 */
import axios, { AxiosError } from 'axios';
import { loginPath } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Removes what the old script-readable login left behind: the token in
 * localStorage, the cached dealer, and the mxd_token cookie. Those sessions end;
 * the dealer signs in once more and gets the httpOnly cookie.
 */
export function clearLegacySession(): void {
  localStorage.removeItem('dealerToken');
  localStorage.removeItem('mxd_token');
  localStorage.removeItem('mxd_dealer');
  document.cookie = 'mxd_token=; path=/; SameSite=Lax; max-age=0';
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Background call: on 401, fail quietly instead of signing out and redirecting. */
    quietAuth?: boolean;
  }
}

const api = axios.create({ baseURL: BASE, withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // The API has already cleared a session cookie that stopped working.
    if (error.response?.status === 401 && typeof window !== 'undefined' && !error.config?.quietAuth) {
      window.location.href = loginPath();
    }
    return Promise.reject(error);
  }
);

// Auth
export interface SessionDealer {
  id: string;
  ownerName: string;
  shopName: string;
  mobile: string;
  status: string;
}

/** The body of a failed auth call: a stable error code, plus details where they apply. */
export interface AuthApiError {
  error?: string;
  message?: string;
  retryAfter?: number;
  attemptsLeft?: number;
}

export type VerifyOtpResult =
  | { success: true; newDealer: true; mobile: string }
  | { success: true; newDealer: false; user: { id: string; phone: string }; dealer: SessionDealer };

export const authApi = {
  sendOtp: (mobile: string) =>
    api.post<{ success: true; expiresIn: number; resendIn: number }>('/auth/send-otp', { mobile }),
  verifyOtp: (mobile: string, otp: string) => api.post<VerifyOtpResult>('/auth/verify-otp', { mobile, otp }),
  // Quiet: an expired verification is shown on the form instead of leaving it.
  register: (data: Record<string, unknown>) =>
    api.post<{ success: true; user: { id: string; phone: string }; dealer: SessionDealer }>('/auth/register', data, {
      quietAuth: true,
    }),
  // Quiet: being signed out is a normal answer here, not a reason to redirect.
  me: () =>
    api.get<{ success: true; sub: string; phone: string; dealer: SessionDealer }>('/auth/me', { quietAuth: true }),
  logout: () => api.post('/auth/logout', null, { quietAuth: true }),
  // The number this phone remembers (it verified with a code before), or null.
  device: () => api.get<{ success: true; mobile: string | null }>('/auth/device', { quietAuth: true }),
  // Number-only sign-in on a remembered phone; 401 otp_required anywhere else.
  deviceLogin: (mobile: string) =>
    api.post<{ success: true; user: { id: string; phone: string }; dealer: SessionDealer }>(
      '/auth/device-login',
      { mobile },
      { quietAuth: true }
    ),
};

// Products
export const productsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
};

// Categories
export const categoriesApi = {
  tree: () => api.get('/categories'),
  getBySlug: (slug: string) => api.get(`/categories/${slug}`),
};

// Cart
export const cartApi = {
  get: () => api.get('/cart'),
  addOrUpdate: (productId: string, quantity: number) =>
    api.post('/cart', { productId, quantity }),
  remove: (productId: string) => api.delete(`/cart/${productId}`),
  clear: () => api.delete('/cart'),
};

// Dealer
export const dealerApi = {
  me: () => api.get('/dealers/me'),
  update: (data: Record<string, unknown>) => api.put('/dealers/me', data),
  myInquiries: () => api.get('/dealers/me/inquiries'),
  // The dealer's own price per product, or { showPrices: false } while an admin
  // has their prices switched off. Quiet: an expired session just shows no price.
  prices: (productIds: string[]) =>
    api.get<{ success: boolean; data: DealerPrices }>('/dealers/me/prices', {
      params: { ids: productIds.join(',') },
      quietAuth: true,
    }),
};

export type DealerPrices =
  | { showPrices: false }
  | { showPrices: true; prices: Record<string, number | null> };

// Notifications
export const notificationsApi = {
  notifyMe: (productId: string, phoneNumber: string) =>
    api.post('/notify-me', { productId, phoneNumber }),
  submitInquiry: (items: { productId: string; quantity: number }[], notes?: string) =>
    api.post('/inquiry', { items, notes }),
};

// Geo
export const geoApi = {
  check: () => api.get('/geo/check'),
};

// Brands (public)
export const brandsApi = {
  list: () => api.get('/brands'),
};

// Product features / supported technologies (public)
export const featuresApi = {
  list: () => api.get('/features'),
};

export default api;
