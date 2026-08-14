import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CartPriceTokenService, PricedCartLine } from './cart-price-token.service';

describe('CartPriceTokenService', () => {
  let service: CartPriceTokenService;

  const lines: PricedCartLine[] = [
    { productId: 'p2', quantity: 3, snapshotPrice: 41.8, snapshotMoq: 10 },
    { productId: 'p1', quantity: 1, snapshotPrice: 20, snapshotMoq: 1 },
  ];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CartPriceTokenService,
        { provide: ConfigService, useValue: { get: () => 'test-secret' } },
      ],
    }).compile();
    service = moduleRef.get(CartPriceTokenService);
  });

  it('hashes the same lines identically regardless of input order', () => {
    const reordered = [lines[1], lines[0]];
    expect(service.hashLines('cart-1', lines)).toBe(service.hashLines('cart-1', reordered));
  });

  it('hashes different carts to different values', () => {
    expect(service.hashLines('cart-1', lines)).not.toBe(service.hashLines('cart-2', lines));
  });

  it('hashes a changed price to a different value', () => {
    const changed = [{ ...lines[0], snapshotPrice: 42.0 }, lines[1]];
    expect(service.hashLines('cart-1', lines)).not.toBe(service.hashLines('cart-1', changed));
  });

  it('verifies a token it just signed', () => {
    const hash = service.hashLines('cart-1', lines);
    const token = service.sign(hash);
    expect(service.verify(token, hash)).toBe(true);
  });

  it('rejects a token verified against a different hash', () => {
    const hash = service.hashLines('cart-1', lines);
    const otherHash = service.hashLines('cart-1', [{ ...lines[0], quantity: 99 }, lines[1]]);
    const token = service.sign(hash);
    expect(service.verify(token, otherHash)).toBe(false);
  });

  it('rejects a tampered token', () => {
    const hash = service.hashLines('cart-1', lines);
    const token = service.sign(hash);
    const tampered = token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(service.verify(tampered, hash)).toBe(false);
  });

  it('rejects an expired token', () => {
    const hash = service.hashLines('cart-1', lines);
    const token = service.sign(hash, -1); // already expired
    expect(service.verify(token, hash)).toBe(false);
  });

  it('rejects garbage input without throwing', () => {
    expect(service.verify('not-a-real-token', 'whatever')).toBe(false);
  });
});
