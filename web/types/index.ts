export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type BusinessType =
  | 'RETAIL_SHOP'
  | 'WHOLESALER'
  | 'DISTRIBUTOR'
  | 'REPAIR_SHOP'
  | 'ONLINE_SELLER'
  | 'MOBILE_ACCESSORIES_STORE';

export type DealerStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'REJECTED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  productCount: number;
  children: Category[];
}

export interface ProductAttribute {
  name: string;
  value: string;
  unit: string | null;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  sku: string;
  description: string | null;
  moq: number;
  stockStatus: StockStatus;
  stockQty: number;
  images: string[];
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  attributes: ProductAttribute[];
  compatibilityTags: string[];
  createdAt: string;
  updatedAt: string;
  breadcrumb?: { name: string; slug: string }[];
}

export interface CartProduct {
  id: string;
  name: string;
  brand: string;
  sku: string;
  moq: number;
  stockStatus: StockStatus;
  images: string[];
  category: { name: string; slug: string } | null;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: CartProduct;
}

export interface Dealer {
  id: string;
  mobile: string;
  ownerName: string;
  shopName: string;
  whatsappNumber: string;
  altMobile: string | null;
  city: string;
  tehsil: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  gstNumber: string | null;
  businessType: BusinessType;
  status: DealerStatus;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
