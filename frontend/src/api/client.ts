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

export type RetailerProfile = {
  id: string;
  shopName: string;
  address?: string | null;
} | null;
export type WholesalerProfile = {
  id: string;
  shopName: string;
  mandiId: string;
  address?: string | null;
} | null;
export type MandiAdminProfile = { id: string; mandiId: string } | null;
export type DeliveryPartnerProfile = {
  id: string;
  name: string;
  vehicleInfo?: string | null;
  mandiId: string;
} | null;

export type AuthUser = {
  id: string;
  phone: string;
  profiles: {
    retailer: RetailerProfile;
    wholesaler: WholesalerProfile;
    mandiAdmin: MandiAdminProfile;
    deliveryPartner: DeliveryPartnerProfile;
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

export function createRetailerProfile(token: string, shopName: string, address?: string) {
  return request<{ token: string; profile: RetailerProfile }>(
    '/auth/profiles/retailer',
    { method: 'POST', token, body: { shopName, address } },
  );
}

export function createWholesalerProfile(
  token: string,
  shopName: string,
  mandiId: string,
  address?: string,
) {
  return request<{ token: string; profile: WholesalerProfile }>(
    '/auth/profiles/wholesaler',
    { method: 'POST', token, body: { shopName, mandiId, address } },
  );
}

export function updateRetailerAddress(token: string, address: string) {
  return request<RetailerProfile>('/auth/profiles/retailer/address', {
    method: 'PATCH',
    token,
    body: { address },
  });
}

export function updateWholesalerAddress(token: string, address: string) {
  return request<WholesalerProfile>('/auth/profiles/wholesaler/address', {
    method: 'PATCH',
    token,
    body: { address },
  });
}

/* ---------------------------------- cart ---------------------------------- */

export type CartLineItem = {
  id: string;
  wholesalerListingId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    brand: string | null;
    packLabel: string;
  } | null;
  wholesalerName: string;
  wholesalerProfileId: string | null;
  pricePerUnit: number;
  lineTotal: number;
  moq: number;
  stockUnits: number;
  belowMoq: boolean;
  overStock: boolean;
  unavailable: boolean;
  isValid: boolean;
};

export type CartView = {
  id: string;
  itemCount: number;
  canCheckout: boolean;
  subtotal: number;
  wholesalerGroups: Array<{
    wholesalerProfileId: string;
    wholesalerName: string;
    items: CartLineItem[];
    subtotal: number;
  }>;
  items: CartLineItem[];
};

export function getCart(token: string) {
  return request<CartView>('/cart', { token });
}

export function addCartItem(token: string, wholesalerListingId: string, quantity: number) {
  return request<CartView>('/cart/items', {
    method: 'POST',
    token,
    body: { wholesalerListingId, quantity },
  });
}

export function updateCartItem(token: string, itemId: string, quantity: number) {
  return request<CartView>(`/cart/items/${itemId}`, {
    method: 'PATCH',
    token,
    body: { quantity },
  });
}

export function removeCartItem(token: string, itemId: string) {
  return request<CartView>(`/cart/items/${itemId}`, {
    method: 'DELETE',
    token,
  });
}

/* --------------------------------- orders --------------------------------- */

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'rejected'
  | 'packed'
  | 'assigned'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'delivery_failed';

export type PaymentMethod = 'cod' | 'udhaar';
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed';

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  subtotal: number;
  itemCount: number;
  deliveryAddress: string;
  wholesalerName: string | null;
  retailerName: string | null;
  placedAt: string;
  confirmedAt: string | null;
  packedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
};

export type OrderDetail = OrderSummary & {
  cancelReason: string | null;
  rejectReason: string | null;
  items: Array<{
    id: string;
    productName: string;
    packLabel: string;
    quantity: number;
    pricePerUnit: number;
    lineTotal: number;
  }>;
};

export function checkout(token: string, paymentMethod: PaymentMethod) {
  return request<OrderSummary[]>('/checkout', {
    method: 'POST',
    token,
    body: { paymentMethod },
  });
}

export function listMyOrders(token: string, status?: OrderStatus) {
  const suffix = status ? `?status=${status}` : '';
  return request<OrderSummary[]>(`/orders${suffix}`, { token });
}

export function getOrder(token: string, orderId: string) {
  return request<OrderDetail>(`/orders/${orderId}`, { token });
}

export function cancelOrder(token: string, orderId: string) {
  return request<OrderDetail>(`/orders/${orderId}/cancel`, { method: 'POST', token });
}

export function listIncomingOrders(token: string, status?: OrderStatus) {
  const suffix = status ? `?status=${status}` : '';
  return request<OrderSummary[]>(`/wholesaler/orders${suffix}`, { token });
}

export function getIncomingOrder(token: string, orderId: string) {
  return request<OrderDetail>(`/wholesaler/orders/${orderId}`, { token });
}

export function confirmOrder(token: string, orderId: string) {
  return request<OrderDetail>(`/wholesaler/orders/${orderId}/confirm`, {
    method: 'POST',
    token,
  });
}

export function rejectOrder(token: string, orderId: string, reason: string) {
  return request<OrderDetail>(`/wholesaler/orders/${orderId}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export function packOrder(token: string, orderId: string) {
  return request<OrderDetail>(`/wholesaler/orders/${orderId}/pack`, {
    method: 'POST',
    token,
  });
}

/* -------------------------------- delivery -------------------------------- */

export type DeliveryStatus = 'unassigned' | 'assigned' | 'picked_up' | 'delivered' | 'failed';

export type DeliveryView = {
  id: string;
  status: DeliveryStatus;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    subtotal: number;
    deliveryAddress: string;
    retailerName: string | null;
    wholesalerName: string | null;
    paymentMethod: PaymentMethod;
  } | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
};

export function listUnassignedDeliveries(token: string) {
  return request<DeliveryView[]>('/admin/deliveries', { token });
}

export type DeliveryPartner = { id: string; name: string; vehicleInfo: string | null };

export function listDeliveryPartners(token: string) {
  return request<DeliveryPartner[]>('/admin/deliveries/partners', { token });
}

export function assignDelivery(token: string, deliveryId: string, deliveryPartnerId: string) {
  return request<DeliveryView>(`/admin/deliveries/${deliveryId}/assign`, {
    method: 'POST',
    token,
    body: { deliveryPartnerId },
  });
}

export function listMyDeliveries(token: string) {
  return request<DeliveryView[]>('/rider/deliveries', { token });
}

export function markPickedUp(token: string, deliveryId: string) {
  return request<DeliveryView>(`/rider/deliveries/${deliveryId}/picked-up`, {
    method: 'POST',
    token,
  });
}

export function markDelivered(token: string, deliveryId: string, paymentCollected?: boolean) {
  return request<DeliveryView>(`/rider/deliveries/${deliveryId}/delivered`, {
    method: 'POST',
    token,
    body: { paymentCollected },
  });
}

export function markDeliveryFailed(token: string, deliveryId: string, reason: string) {
  return request<DeliveryView>(`/rider/deliveries/${deliveryId}/failed`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

/* --------------------------------- wallet --------------------------------- */

export type UdhaarTransaction = {
  id: string;
  type: 'draw' | 'repayment' | 'adjustment';
  amount: number;
  balanceAfter: number;
  note: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletView = {
  creditLimit: number;
  outstandingBalance: number;
  available: number;
  transactions: UdhaarTransaction[];
};

export function getMyWallet(token: string) {
  return request<WalletView>('/wallet/me', { token });
}
