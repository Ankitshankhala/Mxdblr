import axios, { AxiosError } from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dealerToken') || localStorage.getItem('mxd_token');
}

export function setToken(token: string): void {
  localStorage.setItem('dealerToken', token);
  localStorage.setItem('mxd_token', token);
  // Also persist as a cookie so Next.js middleware can verify auth server-side.
  // Not HttpOnly — JS needs to clear it on logout.
  // max-age=604800 = 7 days, matching typical dealer JWT expiry.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `mxd_token=${token}; path=/; SameSite=Lax; max-age=604800${secure}`;
}

export function clearToken(): void {
  localStorage.removeItem('dealerToken');
  localStorage.removeItem('mxd_token');
  localStorage.removeItem('mxd_dealer');
  // Expire the middleware cookie immediately.
  document.cookie = 'mxd_token=; path=/; SameSite=Lax; max-age=0';
}

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearToken();
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  sendOtp: (mobile: string) => api.post('/auth/send-otp', { mobile }),
  verifyOtp: (mobile: string, otp: string) => api.post('/auth/verify-otp', { mobile, otp }),
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
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
};

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

export default api;
