const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message ?? `Request failed: ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return data as T;
}

export type HealthResponse = {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  database: { connected: boolean; latencyMs: number | null };
};

export function getBackendHealth() {
  return request<HealthResponse>('/health');
}

export type Mandi = { id: string; name: string; city: string };

export function listMandis() {
  return request<Mandi[]>('/mandis');
}

/* ------------------------------- catalogue ------------------------------- */

export type Category = {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  icon: string | null;
  tint: string | null;
  iconColor: string | null;
  sortOrder: number;
};

export type Pack = {
  value: number;
  unit: string;
  label: string;
  baseValue: number;
  baseUnit: 'g' | 'ml' | 'count';
};

export type Offers = {
  sellerCount: number;
  lowestPrice: number | null;
};

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: Pick<Category, 'id' | 'slug' | 'nameEn' | 'nameHi'> | null;
  pack: Pack;
  imagePath: string | null;
  status: 'active' | 'archived';
  offers: Offers;
};

export type StockStatus = 'in_stock' | 'low' | 'out';

export type Seller = {
  listingId: string;
  wholesalerName: string;
  mandiName: string | null;
  mandiCity: string | null;
  pricePerUnit: number;
  mrp: number | null;
  savingsVsMrp: number | null;
  moq: number;
  stockUnits: number;
  stockStatus: StockStatus;
  isBestPrice: boolean;
};

export type ProductAlias = {
  id: string;
  alias: string;
  locale: 'en' | 'hi' | 'other';
  source: 'admin' | 'merge' | 'system';
};

export type ProductDetail = Product & {
  aliases: ProductAlias[];
  sellers: Seller[];
};

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function listCategories() {
  return request<Category[]>('/categories');
}

export function searchProducts(params: {
  q?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<Paged<Product>>(`/products${suffix}`);
}

export function getProduct(id: string) {
  return request<ProductDetail>(`/products/${id}`);
}

/* --------------------------- wholesaler listings -------------------------- */

export type Listing = {
  id: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    categoryName: string | null;
    packLabel: string;
  } | null;
  pricePerUnit: number;
  mrp: number | null;
  savingsVsMrp: number | null;
  stockUnits: number;
  stockStatus: StockStatus;
  moq: number;
  status: 'active' | 'inactive';
  isActive: boolean;
};

export type InventoryResponse = {
  summary: {
    listingCount: number;
    stockValue: number;
    lowOrOutCount: number;
  };
  items: Listing[];
};

export function getMyInventory(token: string) {
  return request<InventoryResponse>('/wholesaler/listings', { token });
}

export function createListing(
  token: string,
  body: {
    productId: string;
    pricePerUnit: number;
    mrp?: number;
    stockUnits: number;
    moq?: number;
  },
) {
  return request<Listing>('/wholesaler/listings', {
    method: 'POST',
    token,
    body,
  });
}

export function updateListing(
  token: string,
  listingId: string,
  body: {
    pricePerUnit?: number;
    mrp?: number;
    stockUnits?: number;
    moq?: number;
    status?: 'active' | 'inactive';
  },
) {
  return request<Listing>(`/wholesaler/listings/${listingId}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function deleteListing(token: string, listingId: string) {
  return request<{ deleted: boolean }>(`/wholesaler/listings/${listingId}`, {
    method: 'DELETE',
    token,
  });
}

export type RequestOtpResponse = { devOtp: string; expiresInSeconds: number };

export function requestOtp(phone: string) {
  // NOTE: `devOtp` is only present because SMS sending is stubbed on the
  // backend (see project TODO.md). Don't rely on it once that's wired up.
  return request<RequestOtpResponse>('/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
}

export type RetailerProfile = { id: string; shopName: string } | null;
export type WholesalerProfile = { id: string; shopName: string; mandiId: string } | null;
export type MandiAdminProfile = { id: string; mandiId: string } | null;

export type AuthUser = {
  id: string;
  phone: string;
  profiles: {
    retailer: RetailerProfile;
    wholesaler: WholesalerProfile;
    mandiAdmin: MandiAdminProfile;
  };
};

export type AuthResponse = { token: string; user: AuthUser };

export function verifyOtp(phone: string, otp: string) {
  return request<AuthResponse>('/auth/otp/verify', {
    method: 'POST',
    body: { phone, otp },
  });
}

export function getMe(token: string) {
  return request<AuthUser>('/auth/me', { token });
}

export function createRetailerProfile(token: string, shopName: string) {
  return request<{ token: string; profile: RetailerProfile }>(
    '/auth/profiles/retailer',
    { method: 'POST', token, body: { shopName } },
  );
}

export function createWholesalerProfile(token: string, shopName: string, mandiId: string) {
  return request<{ token: string; profile: WholesalerProfile }>(
    '/auth/profiles/wholesaler',
    { method: 'POST', token, body: { shopName, mandiId } },
  );
}
