export type JwtPayload = {
  sub: string; // user id
  phone: string;
  profiles: Array<'retailer' | 'wholesaler' | 'mandi_admin' | 'delivery_partner'>;
};
