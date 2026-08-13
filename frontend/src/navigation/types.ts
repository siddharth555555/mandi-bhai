import type { NavigatorScreenParams } from '@react-navigation/native';

export type RetailerTabParamList = {
  Home: undefined;
  Categories: { categoryId?: string } | undefined;
  BuyAgain: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type RetailerStackParamList = {
  Tabs: NavigatorScreenParams<RetailerTabParamList>;
  ProductDetail: { productId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderDetail: { orderId: string };
  Wallet: undefined;
};

export type WholesalerTabParamList = {
  Inventory: undefined;
  Catalogue: undefined;
  Orders: undefined;
  WholesalerProfile: undefined;
};

export type WholesalerStackParamList = {
  Tabs: NavigatorScreenParams<WholesalerTabParamList>;
  AddListing: { productId: string; productName: string; packLabel: string };
  EditListing: { listingId: string };
  WholesalerOrderDetail: { orderId: string };
};

export type RootStackParamList = {
  Phone: undefined;
  Otp: { phone: string; devOtp: string };
  CreateProfile: undefined;
  Retailer: NavigatorScreenParams<RetailerStackParamList>;
  Wholesaler: NavigatorScreenParams<WholesalerStackParamList>;
  MandiAdminHome: undefined;
  RiderHome: undefined;
};
