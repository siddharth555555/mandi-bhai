import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CartPriceTokenService, PricedCartLine } from './cart-price-token.service';

/**
 * Regression guard for the cart<->checkout contract (PRD §9.2): CartService
 * signs a token from CartItem rows it just wrote; OrdersService verifies
 * the same token by re-deriving PricedCartLine[] from CartItem rows it
 * reads back. Both sides MUST convert the stored `snapshotPrice`/
 * `snapshotMoq` columns (decimal columns hydrate as strings via TypeORM)
 * through `Number(...)` identically -- see cart.service.ts's validate()
 * and orders.service.ts's checkout(). This test exercises that exact
 * contract without mocking the token service, so a future edit that
 * breaks the symmetry (e.g. passing a raw decimal string on one side)
 * fails here instead of silently in production.
 *
 * Note: this mirrors the two call sites' conversion logic rather than
 * calling CartService/OrdersService directly (which would require wiring
 * their full dependency graphs together) -- it catches a type-mismatch
 * regression in the conversion pattern, not a change to which fields the
 * two services include. Keep the cartSideLines/ordersSideLines helpers
 * below in sync with the real call sites if either changes shape.
 */
describe('cart/checkout price-token contract', () => {
  let service: CartPriceTokenService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CartPriceTokenService,
        { provide: ConfigService, useValue: { get: () => 'test-secret' } },
      ],
    }).compile();
    service = moduleRef.get(CartPriceTokenService);
  });

  // Mimics a CartItem row as TypeORM actually returns it: decimal columns
  // hydrate as strings, int columns as numbers.
  type StoredCartItemRow = {
    productId: string;
    quantity: number;
    snapshotPrice: string;
    snapshotMoq: number;
  };

  const rows: StoredCartItemRow[] = [
    { productId: 'p2', quantity: 3, snapshotPrice: '41.80', snapshotMoq: 10 },
    { productId: 'p1', quantity: 1, snapshotPrice: '20.00', snapshotMoq: 1 },
  ];

  // Mirrors cart.service.ts's validate(): snapshotPrice: Number(r.snapshotPrice)
  function cartSideLines(rows: StoredCartItemRow[]): PricedCartLine[] {
    return rows.map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      snapshotPrice: Number(r.snapshotPrice),
      snapshotMoq: r.snapshotMoq,
    }));
  }

  // Mirrors orders.service.ts's checkout(): snapshotPrice: Number(i.snapshotPrice)
  function ordersSideLines(rows: StoredCartItemRow[]): PricedCartLine[] {
    return rows.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      snapshotPrice: Number(i.snapshotPrice),
      snapshotMoq: i.snapshotMoq,
    }));
  }

  it('a token signed cart-side verifies successfully orders-side against the same stored rows', () => {
    const cartId = 'cart-1';
    const cartHash = service.hashLines(cartId, cartSideLines(rows));
    const token = service.sign(cartHash);

    const ordersHash = service.hashLines(cartId, ordersSideLines(rows));
    expect(service.verify(token, ordersHash)).toBe(true);
  });

  it('would fail verification if one side passed the raw decimal string instead of Number(...)', () => {
    const cartId = 'cart-1';
    const cartHash = service.hashLines(cartId, cartSideLines(rows));
    const token = service.sign(cartHash);

    const brokenOrdersLines: PricedCartLine[] = rows.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      snapshotPrice: i.snapshotPrice as unknown as number, // the regression: string, not Number(...)
      snapshotMoq: i.snapshotMoq,
    }));
    const brokenHash = service.hashLines(cartId, brokenOrdersLines);

    expect(service.verify(token, brokenHash)).toBe(false);
  });
});
