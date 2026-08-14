# Phase 0 / Plan A — Cart & Checkout Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the backend compiling again by finishing the marketplace→managed-reseller pivot's cart/checkout slice — retailer cart re-prices through `PricingService` instead of a chosen `WholesalerListing`, checkout creates one anonymised customer `Order` (no wholesaler fan-out), price/MOQ are re-validated at both cart-open and place-order, and the Udhaar/wallet feature is fully removed from the code paths that still reference it.

**Architecture:** `CartItem` now snapshots `{price, moq}` at add-time. `POST /cart/validate` re-syncs every line's snapshot against live `PricingService` output and, only if every line is clean, issues a signed, stateless `confirmedPriceToken` (HMAC, no new table). `POST /checkout` re-verifies that token against the cart's current snapshots *and* re-checks live pricing independently (the two explicit re-validation points PRD §9.2 requires), then creates one `Order` + `OrderItem[]` + one `Payment` in a transaction — no wholesaler, no listing, no stock touched, because sourcing doesn't exist yet (next plan). Wallet/Udhaar is deleted down to the parked entities PRD §9.4 says to keep.

**Tech Stack:** NestJS 11, TypeORM, Postgres (`synchronize: true`, unchanged), Jest + `ts-jest`, existing `Test.createTestingModule` + `getRepositoryToken` mocking style (see `pricing.service.spec.ts`).

**Spec:** [`../../../BRD.md`](../../../BRD.md), [`../../../PRD.md`](../../../PRD.md) — this plan implements PRD §9 (cart/re-validation), the checkout half of §9.4 (Udhaar descope), and the compile-fix prerequisite noted in PRD §4 (S4, L3, L4, L7, S15 partial, S16). It deliberately does **not** implement PRD §10 (allocation engine), §11 (cutoff batching), or §12 (real notifications) — those need `PurchaseOrder`, `Mandi.cutoffTime`, and `DeliveryBatch`, none of which exist yet, and are the next plan in this series ("Plan B — Allocation, Sourcing & Cutoff Batching").

## Global Constraints

- No retailer-facing response may ever contain a wholesaler name, wholesaler id, mandi name/city tied to a supplier, or the raw minimum quote (PRD G2, G4, N3). This plan's cart/order/checkout payloads must be checked against this on every task.
- `PaymentMethod` is `cod | prepaid` — `udhaar` is removed from the enum and from every code path (PRD S16, §9.4 disposition table).
- `UdhaarAccount` and `UdhaarTransaction` **entities stay registered** in `app.module.ts` (table retained) but must have **zero write paths** after this plan (PRD §9.4).
- `backend/src/seed/seed.ts` must keep running clean (`npm run seed`, idempotent, no errors) after every task — this plan does not touch any entity seed.ts writes to (`Mandi`, `User`, profiles, `Category`, `Product`, `ProductAlias`, `WholesalerListing`), so this is a "don't break it" constraint, not a "build it" one.
- `synchronize: true` stays on (`app.module.ts`) — no migrations in this plan (PRD S11 is explicitly last, after schema stabilises).
- No entity beyond what this plan's own design calls for — do not pre-add fields/enum values for states this plan's code can't reach (e.g. no `batchId`, no `cancellableUntil`, no `PurchaseOrder`). Add them in the plan that makes them reachable.
- Follow the existing test convention exactly: `Test.createTestingModule` from `@nestjs/testing`, repository mocks via `{ provide: getRepositoryToken(Entity), useValue: {...} }` with plain in-memory arrays/objects — see `backend/src/pricing/pricing.service.spec.ts`.

---

## Task 1: CartPriceTokenService

**Files:**
- Create: `backend/src/cart/cart-price-token.service.ts`
- Test: `backend/src/cart/cart-price-token.service.spec.ts`

**Interfaces:**
- Produces: `PricedCartLine` type `{ productId: string; quantity: number; snapshotPrice: number; snapshotMoq: number }`; `CartPriceTokenService.hashLines(cartId: string, lines: PricedCartLine[]): string`; `CartPriceTokenService.sign(hash: string, ttlMs?: number): string`; `CartPriceTokenService.verify(token: string, expectedHash: string): boolean`. Task 2 and Task 4 both consume this exact surface.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/cart/cart-price-token.service.spec.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/cart/cart-price-token.service.spec.ts`
Expected: FAIL — `Cannot find module './cart-price-token.service'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/cart/cart-price-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type PricedCartLine = {
  productId: string;
  quantity: number;
  snapshotPrice: number;
  snapshotMoq: number;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Proves, without a database table, that a retailer explicitly saw and
 * accepted an exact set of cart lines (PRD §9.2). `POST /cart/validate`
 * signs a hash of the just-synced snapshot; `POST /checkout` re-derives the
 * same hash from the cart's current state and verifies the signature,
 * the expiry, and that the hash matches — any drift in price, quantity, or
 * MOQ between the two calls produces a different hash and fails verification
 * (PRD E3).
 */
@Injectable()
export class CartPriceTokenService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('JWT_SECRET', 'dev-only-secret-change-me');
  }

  hashLines(cartId: string, lines: PricedCartLine[]): string {
    const canonical = [...lines]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map((l) => `${l.productId}:${l.quantity}:${l.snapshotPrice}:${l.snapshotMoq}`)
      .join('|');
    return createHash('sha256').update(`${cartId}::${canonical}`).digest('hex');
  }

  sign(hash: string, ttlMs = DEFAULT_TTL_MS): string {
    const expiresAt = Date.now() + ttlMs;
    const payload = `${hash}.${expiresAt}`;
    const signature = createHmac('sha256', this.secret()).update(payload).digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  verify(token: string, expectedHash: string): boolean {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return false;
    }
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [hash, expiresAtStr, signature] = parts;

    const expectedSignature = createHmac('sha256', this.secret())
      .update(`${hash}.${expiresAtStr}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }
    if (hash !== expectedHash) return false;

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/cart/cart-price-token.service.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/cart/cart-price-token.service.ts backend/src/cart/cart-price-token.service.spec.ts
git commit -m "feat(cart): add stateless price-confirmation token service"
```

---

## Task 2: Cart rewrite — Product-priced, snapshot + validate gate

**Files:**
- Modify: `backend/src/cart/cart-item.entity.ts`
- Modify: `backend/src/cart/cart.service.ts`
- Modify: `backend/src/cart/cart.controller.ts`
- Modify: `backend/src/cart/cart.module.ts`
- Test: `backend/src/cart/cart.service.spec.ts`

**Interfaces:**
- Consumes: `CartPriceTokenService` (Task 1), `PricingService.priceFor(productId)` / `.priceForMany(productIds)` returning `{ available, sellingPrice, effectiveMoq, ... }` (existing, `pricing.service.ts`).
- Produces: `CartService.addItem/updateItem/removeItem/getMyCart(userId): CartView`; `CartService.validate(userId): CartView & { confirmedPriceToken: string | null }`. Task 4's checkout consumes the cart's persisted `snapshotPrice`/`snapshotMoq` columns and the token shape directly.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/cart/cart.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { Product } from '../catalog/product.entity';
import { PricingService } from '../pricing/pricing.service';
import { CartPriceTokenService } from './cart-price-token.service';
import { PackUnit } from '../catalog/pack-unit';

const USER_ID = 'user-1';
const RETAILER_ID = 'retailer-1';
const PRODUCT_ID = 'product-1';

function makeProduct(): Product {
  return {
    id: PRODUCT_ID,
    name: 'Aashirvaad Atta 5kg',
    brand: 'Aashirvaad',
    packValue: '5.00',
    packUnit: PackUnit.KG,
  } as Product;
}

describe('CartService', () => {
  let service: CartService;
  let cartRows: Cart[];
  let itemRows: CartItem[];
  let livePrice: { available: boolean; sellingPrice: number | null; effectiveMoq: number };

  beforeEach(async () => {
    cartRows = [{ id: 'cart-1', retailerProfileId: RETAILER_ID } as Cart];
    itemRows = [];
    livePrice = { available: true, sellingPrice: 41.8, effectiveMoq: 10 };
    let idCounter = 0;

    const moduleRef = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: getRepositoryToken(Cart),
          useValue: {
            findOne: async ({ where }: any) =>
              cartRows.find((c) => c.retailerProfileId === where.retailerProfileId) ?? null,
            create: (v: Partial<Cart>) => ({ id: 'cart-1', ...v }) as Cart,
            save: async (v: Cart) => v,
          },
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: {
            find: async ({ where }: any) =>
              itemRows.filter((i) =>
                where.id ? i.id === where.id && i.cartId === where.cartId : i.cartId === where.cartId,
              ),
            findOne: async ({ where }: any) =>
              itemRows.find((i) =>
                where.productId
                  ? i.cartId === where.cartId && i.productId === where.productId
                  : i.id === where.id && i.cartId === where.cartId,
              ) ?? null,
            create: (v: Partial<CartItem>) => ({ id: `item-${++idCounter}`, ...v }) as CartItem,
            save: async (v: CartItem | CartItem[]) => {
              const rows = Array.isArray(v) ? v : [v];
              for (const row of rows) {
                const i = itemRows.findIndex((r) => r.id === row.id);
                if (i >= 0) itemRows[i] = row;
                else itemRows.push(row);
              }
              return v;
            },
            remove: async (v: CartItem) => {
              itemRows = itemRows.filter((r) => r.id !== v.id);
            },
          },
        },
        {
          provide: getRepositoryToken(RetailerProfile),
          useValue: { findOne: async () => ({ id: RETAILER_ID, userId: USER_ID } as RetailerProfile) },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { findOne: async ({ where }: any) => (where.id === PRODUCT_ID ? makeProduct() : null) },
        },
        {
          provide: PricingService,
          useValue: {
            priceFor: async () => livePrice,
            priceForMany: async (ids: string[]) => new Map(ids.map((id) => [id, livePrice])),
          },
        },
        {
          provide: CartPriceTokenService,
          useValue: {
            hashLines: () => 'fake-hash',
            sign: () => 'fake-token',
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CartService);
  });

  it('adds a new line and snapshots the live price/MOQ', async () => {
    const view = await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 12 } as any);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].pricePerUnit).toBe(41.8);
    expect(view.items[0].moq).toBe(10);
  });

  it('rejects adding an unavailable product', async () => {
    livePrice = { available: false, sellingPrice: null, effectiveMoq: 1 };
    await expect(
      service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 1 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('increments quantity and re-snapshots when adding an existing line again', async () => {
    await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 5 } as any);
    livePrice = { available: true, sellingPrice: 45, effectiveMoq: 10 };
    const view = await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 5 } as any);
    expect(view.items[0].quantity).toBe(10);
    expect(view.items[0].pricePerUnit).toBe(45);
  });

  it('flags a line as priceChanged when the live price drifts from the snapshot, without mutating it', async () => {
    await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 12 } as any);
    livePrice = { available: true, sellingPrice: 45, effectiveMoq: 10 };

    const view = await service.getMyCart(USER_ID);
    expect(view.items[0].priceChanged).toBe(true);
    expect(view.items[0].pricePerUnit).toBe(41.8); // snapshot, unchanged by a read
    expect(view.canCheckout).toBe(false);
  });

  it('flags belowMoq when quantity is under the live MOQ', async () => {
    await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 12 } as any);
    livePrice = { available: true, sellingPrice: 41.8, effectiveMoq: 20 };

    const view = await service.getMyCart(USER_ID);
    expect(view.items[0].belowMoq).toBe(true);
    expect(view.canCheckout).toBe(false);
  });

  it('validate() syncs the snapshot to live values and issues a token when clean', async () => {
    await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 12 } as any);
    livePrice = { available: true, sellingPrice: 45, effectiveMoq: 10 };

    const result = await service.validate(USER_ID);
    expect(result.confirmedPriceToken).toBe('fake-token');
    expect(result.items[0].pricePerUnit).toBe(45);
    expect(result.items[0].priceChanged).toBe(false);
  });

  it('validate() withholds the token when a line is below the (now-synced) MOQ', async () => {
    await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 5 } as any);
    livePrice = { available: true, sellingPrice: 41.8, effectiveMoq: 10 };

    const result = await service.validate(USER_ID);
    expect(result.confirmedPriceToken).toBeNull();
    expect(result.canCheckout).toBe(false);
  });

  it('removeItem removes the line', async () => {
    const added = await service.addItem(USER_ID, { productId: PRODUCT_ID, quantity: 12 } as any);
    const view = await service.removeItem(USER_ID, added.items[0].id);
    expect(view.items).toHaveLength(0);
  });

  it('removeItem on an unknown item throws NotFoundException', async () => {
    await expect(service.removeItem(USER_ID, 'nope')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/cart/cart.service.spec.ts`
Expected: FAIL — current `cart.service.ts` still reads `dto.wholesalerListingId` / `WholesalerListing`, so this won't even type-check against the new test's DTO shape and will error on the `WholesalerListing` repository token not being provided.

- [ ] **Step 3: Write minimal implementation**

Update the entity first — add the snapshot columns and correct the stale doc comment:

```typescript
// backend/src/cart/cart-item.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../catalog/product.entity';

/**
 * References a master `Product`, not a wholesaler's listing: under the
 * managed-reseller model the retailer buys from the platform and never
 * chooses a supplier. Sourcing is decided later, at allocation time.
 *
 * `snapshotPrice`/`snapshotMoq`/`snapshotAt` are the price/MOQ the retailer
 * last explicitly saw and accepted (set on add, and re-synced by
 * `POST /cart/validate`). Reads (`GET /cart`) compare this snapshot against
 * a fresh `PricingService` call to detect drift — they never overwrite it
 * silently (PRD §9.2, S7).
 */
@Entity('cart_items')
@Unique('uq_cart_item_product', ['cartId', 'productId'])
@Index(['cartId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  cart: Cart;

  @Column()
  cartId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  product: Product;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  snapshotPrice: string;

  @Column({ type: 'int' })
  snapshotMoq: number;

  @Column({ type: 'timestamp' })
  snapshotAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

Rewrite the service:

```typescript
// backend/src/cart/cart.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { Product } from '../catalog/product.entity';
import { PricingService } from '../pricing/pricing.service';
import { CartPriceTokenService, PricedCartLine } from './cart-price-token.service';
import { formatPack } from '../catalog/pack-unit';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly pricing: PricingService,
    private readonly tokens: CartPriceTokenService,
  ) {}

  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No retailer profile on this account');
    return profile;
  }

  private async getOrCreateCart(retailerProfileId: string): Promise<Cart> {
    let cart = await this.carts.findOne({ where: { retailerProfileId } });
    if (!cart) cart = await this.carts.save(this.carts.create({ retailerProfileId }));
    return cart;
  }

  async getMyCart(userId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);
    return this.buildView(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const product = await this.products.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const price = await this.pricing.priceFor(dto.productId);
    if (!price.available) {
      throw new BadRequestException(`"${product.name}" is currently unavailable`);
    }

    let item = await this.items.findOne({ where: { cartId: cart.id, productId: dto.productId } });
    const quantity = (item?.quantity ?? 0) + dto.quantity;

    if (item) {
      item.quantity = quantity;
    } else {
      item = this.items.create({ cartId: cart.id, productId: dto.productId, quantity });
    }
    // Adding (or re-adding to) a line always syncs to the live price — there
    // is nothing to confirm yet, the retailer is choosing this right now.
    item.snapshotPrice = price.sellingPrice!.toFixed(2);
    item.snapshotMoq = price.effectiveMoq;
    item.snapshotAt = new Date();
    await this.items.save(item);

    return this.buildView(cart);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    // Quantity alone never re-prices the line — only add-item and validate()
    // do, so a quantity bump can't silently mask a price change (S7).
    item.quantity = dto.quantity;
    await this.items.save(item);

    return this.buildView(cart);
  }

  async removeItem(userId: string, itemId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const item = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.items.remove(item);
    return this.buildView(cart);
  }

  /**
   * The explicit re-validation gate (PRD §9.2). Re-prices every line and
   * SYNCS each item's snapshot to the current live figures — this is the
   * retailer "seeing and accepting" the new numbers. Only if every line then
   * clears both the availability/price gate and the MOQ gate is a
   * `confirmedPriceToken` issued; checkout demands and re-verifies it.
   */
  async validate(userId: string) {
    const retailer = await this.requireRetailer(userId);
    const cart = await this.getOrCreateCart(retailer.id);

    const rows = await this.items.find({ where: { cartId: cart.id } });
    if (rows.length === 0) {
      return { ...(await this.buildView(cart)), confirmedPriceToken: null as string | null };
    }

    const prices = await this.pricing.priceForMany(rows.map((r) => r.productId));
    const now = new Date();
    for (const row of rows) {
      const price = prices.get(row.productId);
      if (!price?.available) continue; // left unsynced — still flagged unavailable below
      row.snapshotPrice = price.sellingPrice!.toFixed(2);
      row.snapshotMoq = price.effectiveMoq;
      row.snapshotAt = now;
    }
    await this.items.save(rows);

    const view = await this.buildView(cart);
    if (!view.canCheckout) {
      return { ...view, confirmedPriceToken: null as string | null };
    }

    const lines: PricedCartLine[] = rows.map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      snapshotPrice: Number(r.snapshotPrice),
      snapshotMoq: r.snapshotMoq,
    }));
    const token = this.tokens.sign(this.tokens.hashLines(cart.id, lines));

    return { ...view, confirmedPriceToken: token };
  }

  private async buildView(cart: Cart) {
    const rows = await this.items.find({ where: { cartId: cart.id }, relations: { product: true } });

    if (rows.length === 0) {
      return { id: cart.id, itemCount: 0, canCheckout: false, subtotal: 0, items: [] as any[] };
    }

    const prices = await this.pricing.priceForMany(rows.map((r) => r.productId));

    const items = rows.map((row) => {
      const product = row.product;
      const live = prices.get(row.productId);
      const unavailable = !live?.available;
      const livePricePerUnit = live?.sellingPrice ?? null;
      const liveMoq = live?.effectiveMoq ?? row.snapshotMoq;
      const priceChanged = !unavailable && livePricePerUnit !== Number(row.snapshotPrice);
      const moqChanged = !unavailable && liveMoq !== row.snapshotMoq;
      const belowMoq = !unavailable && row.quantity < liveMoq;

      return {
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              brand: product.brand ?? null,
              packLabel: formatPack(Number(product.packValue), product.packUnit),
            }
          : null,
        pricePerUnit: Number(row.snapshotPrice),
        livePricePerUnit,
        lineTotal: Math.round(Number(row.snapshotPrice) * row.quantity * 100) / 100,
        moq: row.snapshotMoq,
        liveMoq,
        priceChanged,
        moqChanged,
        belowMoq,
        unavailable,
        isValid: !unavailable && !priceChanged && !moqChanged && !belowMoq,
      };
    });

    return {
      id: cart.id,
      itemCount: items.length,
      canCheckout: items.length > 0 && items.every((i) => i.isValid),
      subtotal: Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
      items,
    };
  }
}
```

Update the controller — add the validate route:

```typescript
// backend/src/cart/cart.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('retailer')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getMine(@Req() req: { user: JwtPayload }) {
    return this.cart.getMyCart(req.user.sub);
  }

  @Post('items')
  addItem(@Req() req: { user: JwtPayload }, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(req.user.sub, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(req.user.sub, id, dto);
  }

  @Delete('items/:id')
  removeItem(@Req() req: { user: JwtPayload }, @Param('id', ParseUUIDPipe) id: string) {
    return this.cart.removeItem(req.user.sub, id);
  }

  @Post('validate')
  validate(@Req() req: { user: JwtPayload }) {
    return this.cart.validate(req.user.sub);
  }
}
```

Update the module — swap `WholesalerListing` for `Product` + `PricingModule`, register the token service, export both for `OrdersModule`:

```typescript
// backend/src/cart/cart.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { Product } from '../catalog/product.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartPriceTokenService } from './cart-price-token.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, RetailerProfile, Product]),
    PricingModule,
  ],
  controllers: [CartController],
  providers: [CartService, CartPriceTokenService],
  exports: [CartService, CartPriceTokenService],
})
export class CartModule {}
```

`AddCartItemDto`/`UpdateCartItemDto` in `backend/src/cart/dto/cart.dto.ts` are already correct from the last commit (`productId`, `quantity`) — no change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/cart/cart.service.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/cart
git commit -m "feat(cart): re-point cart at Product+PricingService, add validate gate"
```

---

## Task 3: Stubbed prepaid payment gateway

**Files:**
- Create: `backend/src/wallet/payment-gateway.driver.ts`
- Test: `backend/src/wallet/payment-gateway.driver.spec.ts`

**Interfaces:**
- Produces: `PaymentGatewayDriver` interface, `StubGatewayDriver implements PaymentGatewayDriver` with `charge(amount: number, orderId: string): Promise<{ success: boolean; gatewayRef: string }>`. Task 4's checkout consumes `StubGatewayDriver.charge`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/wallet/payment-gateway.driver.spec.ts
import { StubGatewayDriver } from './payment-gateway.driver';

describe('StubGatewayDriver', () => {
  it('always succeeds and returns a gateway reference', async () => {
    const driver = new StubGatewayDriver();
    const result = await driver.charge(41.8, 'order-123');
    expect(result.success).toBe(true);
    expect(result.gatewayRef).toContain('order-12'); // slice(0,8) of the id
  });

  it('returns a distinct reference per call', async () => {
    const driver = new StubGatewayDriver();
    const a = await driver.charge(10, 'order-abc');
    const b = await driver.charge(10, 'order-abc');
    expect(a.gatewayRef).not.toBe(b.gatewayRef);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/wallet/payment-gateway.driver.spec.ts`
Expected: FAIL — `Cannot find module './payment-gateway.driver'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/wallet/payment-gateway.driver.ts
import { Injectable, Logger } from '@nestjs/common';

export type GatewayChargeResult = {
  success: boolean;
  gatewayRef: string;
};

export interface PaymentGatewayDriver {
  charge(amount: number, orderId: string): Promise<GatewayChargeResult>;
}

/**
 * No real gateway (Razorpay/Cashfree) is wired up — same "stub now, swap
 * later" pattern as `ConsoleNotificationDriver`. Always succeeds
 * deterministically so prepaid checkout is exercisable in dev (PRD §12, U7).
 */
@Injectable()
export class StubGatewayDriver implements PaymentGatewayDriver {
  private readonly logger = new Logger('PaymentGateway');

  async charge(amount: number, orderId: string): Promise<GatewayChargeResult> {
    const gatewayRef = `STUB-${orderId.slice(0, 8)}-${Date.now()}`;
    this.logger.log(
      `[STUB, no real charge] ₹${amount.toFixed(2)} for order ${orderId} -> ${gatewayRef}`,
    );
    return { success: true, gatewayRef };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/wallet/payment-gateway.driver.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/wallet/payment-gateway.driver.ts backend/src/wallet/payment-gateway.driver.spec.ts
git commit -m "feat(payments): add stubbed prepaid gateway driver"
```

---

## Task 4: Orders rewrite — single customer Order, no wholesaler fan-out, no Udhaar

**Files:**
- Modify: `backend/src/orders/order.entity.ts`
- Modify: `backend/src/orders/order-item.entity.ts`
- Modify: `backend/src/orders/dto/order.dto.ts`
- Modify: `backend/src/orders/orders.service.ts`
- Modify: `backend/src/orders/orders.module.ts`
- Delete: `backend/src/orders/wholesaler-orders.controller.ts`
- Test: `backend/src/orders/orders.service.spec.ts`

**Interfaces:**
- Consumes: `CartPriceTokenService` (Task 1), `CartService`'s persisted `CartItem.snapshotPrice/snapshotMoq` (Task 2), `PricingService.priceForMany` (existing), `StubGatewayDriver.charge` (Task 3).
- Produces: `OrdersService.checkout/listMyOrders/getOrderForRetailer/cancelOrder` — same method names/signatures `retailer-orders.controller.ts` already calls, so that controller needs **no changes**.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/orders/orders.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod, OrderPaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Product } from '../catalog/product.entity';
import { Payment } from '../wallet/payment.entity';
import { StubGatewayDriver } from '../wallet/payment-gateway.driver';
import { PricingService } from '../pricing/pricing.service';
import { CartPriceTokenService } from '../cart/cart-price-token.service';
import { NotificationService } from '../notifications/notification.service';
import { PackUnit } from '../catalog/pack-unit';

const USER_ID = 'user-1';
const RETAILER_ID = 'retailer-1';
const PRODUCT_ID = 'product-1';

describe('OrdersService', () => {
  let service: OrdersService;
  let cartRow: Cart;
  let cartItemRows: CartItem[];
  let orderRows: Order[];
  let orderItemRows: OrderItem[];
  let paymentRows: Payment[];
  let tokenValid: boolean;
  let livePrice: { available: boolean; sellingPrice: number | null; effectiveMoq: number };

  beforeEach(async () => {
    cartRow = { id: 'cart-1', retailerProfileId: RETAILER_ID } as Cart;
    cartItemRows = [
      {
        id: 'item-1',
        cartId: 'cart-1',
        productId: PRODUCT_ID,
        quantity: 12,
        snapshotPrice: '41.80',
        snapshotMoq: 10,
        product: {
          id: PRODUCT_ID,
          name: 'Aashirvaad Atta 5kg',
          packValue: '5.00',
          packUnit: PackUnit.KG,
        } as Product,
      } as CartItem,
    ];
    orderRows = [];
    orderItemRows = [];
    paymentRows = [];
    tokenValid = true;
    livePrice = { available: true, sellingPrice: 41.8, effectiveMoq: 10 };

    const fakeManager = {
      getRepository: (entity: any) => {
        if (entity === Order) {
          return {
            create: (v: Partial<Order>) => ({ id: 'order-1', ...v }) as Order,
            save: async (v: Order) => {
              const i = orderRows.findIndex((r) => r.id === v.id);
              if (i >= 0) orderRows[i] = v;
              else orderRows.push(v);
              return v;
            },
          };
        }
        if (entity === OrderItem) {
          return {
            create: (v: Partial<OrderItem>) => ({ id: `oi-${orderItemRows.length + 1}`, ...v }) as OrderItem,
            save: async (v: OrderItem) => {
              orderItemRows.push(v);
              return v;
            },
          };
        }
        if (entity === Payment) {
          return {
            create: (v: Partial<Payment>) => ({ id: 'payment-1', ...v }) as Payment,
            save: async (v: Payment) => {
              paymentRows.push(v);
              return v;
            },
          };
        }
        if (entity === CartItem) {
          return { delete: async () => { cartItemRows = []; } };
        }
        throw new Error(`Unexpected repository requested: ${entity}`);
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: DataSource,
          useValue: { transaction: async (fn: any) => fn(fakeManager) },
        },
        { provide: getRepositoryToken(Cart), useValue: { findOne: async () => cartRow } },
        {
          provide: getRepositoryToken(CartItem),
          useValue: { find: async () => cartItemRows },
        },
        {
          provide: getRepositoryToken(RetailerProfile),
          useValue: {
            findOne: async () =>
              ({ id: RETAILER_ID, userId: USER_ID, address: 'Shop 1, Test Market' } as RetailerProfile),
          },
        },
        { provide: getRepositoryToken(User), useValue: { findOne: async () => ({ id: USER_ID, phone: '9000000001' }) } },
        { provide: getRepositoryToken(Product), useValue: {} },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: async () => orderRows,
            findOne: async ({ where }: any) => orderRows.find((o) => o.id === where.id) ?? null,
            save: async (v: Order) => {
              const i = orderRows.findIndex((r) => r.id === v.id);
              if (i >= 0) orderRows[i] = v;
              else orderRows.push(v);
              return v;
            },
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { find: async ({ where }: any) => orderItemRows.filter((i) => i.orderId === where.orderId) },
        },
        { provide: getRepositoryToken(Payment), useValue: {} },
        {
          provide: PricingService,
          useValue: { priceForMany: async (ids: string[]) => new Map(ids.map((id) => [id, livePrice])) },
        },
        { provide: CartPriceTokenService, useValue: { hashLines: () => 'hash', verify: () => tokenValid } },
        { provide: StubGatewayDriver, useValue: { charge: async () => ({ success: true, gatewayRef: 'STUB-1' }) } },
        { provide: NotificationService, useValue: { notify: async () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('creates exactly one order from the whole cart and clears it', async () => {
    const detail = await service.checkout(USER_ID, {
      paymentMethod: PaymentMethod.COD,
      confirmedPriceToken: 'tok',
    });
    expect(orderRows).toHaveLength(1);
    expect(detail.items).toHaveLength(1);
    expect(detail.subtotal).toBe(41.8 * 12);
    expect(cartItemRows).toHaveLength(0);
  });

  it('rejects checkout when the token fails verification', async () => {
    tokenValid = false;
    await expect(
      service.checkout(USER_ID, { paymentMethod: PaymentMethod.COD, confirmedPriceToken: 'tok' }),
    ).rejects.toThrow(BadRequestException);
    expect(orderRows).toHaveLength(0);
  });

  it('rejects checkout when the live price drifted again since validation', async () => {
    livePrice = { available: true, sellingPrice: 45, effectiveMoq: 10 };
    await expect(
      service.checkout(USER_ID, { paymentMethod: PaymentMethod.COD, confirmedPriceToken: 'tok' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects checkout when quantity is now below the live MOQ', async () => {
    livePrice = { available: true, sellingPrice: 41.8, effectiveMoq: 20 };
    await expect(
      service.checkout(USER_ID, { paymentMethod: PaymentMethod.COD, confirmedPriceToken: 'tok' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('charges through the gateway and marks paid for a prepaid order', async () => {
    const detail = await service.checkout(USER_ID, {
      paymentMethod: PaymentMethod.PREPAID,
      confirmedPriceToken: 'tok',
    });
    expect(paymentRows[0].status).toBe('collected');
    expect(orderRows[0].paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(detail.paymentMethod).toBe(PaymentMethod.PREPAID);
  });

  it('cancels a placed order', async () => {
    await service.checkout(USER_ID, { paymentMethod: PaymentMethod.COD, confirmedPriceToken: 'tok' });
    const cancelled = await service.cancelOrder(USER_ID, 'order-1');
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  });

  it('refuses to cancel an already-cancelled order', async () => {
    await service.checkout(USER_ID, { paymentMethod: PaymentMethod.COD, confirmedPriceToken: 'tok' });
    await service.cancelOrder(USER_ID, 'order-1');
    await expect(service.cancelOrder(USER_ID, 'order-1')).rejects.toThrow(BadRequestException);
  });

  it('cancelling an unknown order throws NotFoundException', async () => {
    await expect(service.cancelOrder(USER_ID, 'nope')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts`
Expected: FAIL — current `orders.service.ts` still groups by `wholesalerProfileId`, still requires `UdhaarAccount`/`WholesalerListing`/`Delivery` repos this test doesn't provide, and `CheckoutDto` doesn't yet have `confirmedPriceToken`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/orders/order.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RetailerProfile } from '../entities/retailer-profile.entity';

export enum OrderStatus {
  PLACED = 'placed',
  CANCELLED = 'cancelled',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
}

export enum PaymentMethod {
  COD = 'cod',
  PREPAID = 'prepaid',
}

export enum OrderPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

/**
 * The retailer's single order with the platform — the "customer order" side
 * of the two-object model (PRD §9.1). It never carries a wholesaler:
 * sourcing happens later against internal PurchaseOrders, which don't exist
 * yet — they land with the allocation engine in the next plan.
 *
 * `mandiId` is deliberately absent: nothing in this plan determines which
 * mandi an order sources from (that's an allocation-time decision, and
 * `RetailerProfile` itself has no mandi field yet either — see
 * `pricing.service.ts`'s own note on this gap). Add it once sourcing or
 * cutoff batching actually needs it.
 *
 * `status` intentionally keeps `assigned/picked_up/delivered/delivery_failed`
 * because `DeliveryService`'s rider/admin actions (unchanged in this plan)
 * still write them — but drops `confirmed/rejected/packed`, the wholesaler
 * states nothing writes anymore now that a customer order has no wholesaler.
 */
@Entity('orders')
@Index(['retailerProfileId'])
@Index(['status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @ManyToOne(() => RetailerProfile, { onDelete: 'RESTRICT' })
  retailerProfile: RetailerProfile;

  @Column()
  retailerProfileId: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PLACED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: OrderPaymentStatus, default: OrderPaymentStatus.PENDING })
  paymentStatus: OrderPaymentStatus;

  /** Platform selling total the retailer was charged — min quote + markup, summed. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ type: 'int' })
  itemCount: number;

  @Column()
  deliveryAddress: string;

  @CreateDateColumn()
  placedAt: Date;

  /** When checkout's two-point price re-validation passed and the order was created. */
  @Column({ type: 'timestamp', nullable: true })
  confirmedPriceAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// backend/src/orders/order-item.entity.ts
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../catalog/product.entity';

/**
 * Snapshots product name/pack/price at checkout — same "orders are
 * immutable receipts" reasoning used elsewhere. `pricePerUnit` is the
 * platform selling price the retailer approved via cart validation
 * (PRD §9.2) and is what was actually charged; it isn't split into a
 * separate "approved vs current" figure yet because nothing can raise it
 * post-placement until re-sourcing exists (next plan — see PRD
 * `OrderItem.approvedSellingPricePerUnit`).
 */
@Entity('order_items')
@Index(['orderId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  product: Product;

  @Column()
  productId: string;

  @Column()
  productNameSnapshot: string;

  @Column()
  packSizeSnapshot: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lineTotal: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

```typescript
// backend/src/orders/dto/order.dto.ts
import { IsEnum, IsString } from 'class-validator';
import { PaymentMethod } from '../order.entity';

export class CheckoutDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** Issued by `POST /cart/validate` — proves the retailer saw and accepted these exact prices (PRD §9.2). */
  @IsString()
  confirmedPriceToken: string;
}
```

`RejectOrderDto` and `CancelOrderDto` are deleted along with this file's old content — they were only used by the now-deleted wholesaler `reject()` action and by a `cancel` route that never actually passed a body.

```typescript
// backend/src/orders/orders.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Product } from '../catalog/product.entity';
import { Payment, PaymentStatus } from '../wallet/payment.entity';
import { StubGatewayDriver } from '../wallet/payment-gateway.driver';
import { PricingService } from '../pricing/pricing.service';
import { CartPriceTokenService, PricedCartLine } from '../cart/cart-price-token.service';
import { formatPack } from '../catalog/pack-unit';
import { NotificationService } from '../notifications/notification.service';
import { CheckoutDto } from './dto/order.dto';

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `MB-${year}-${suffix}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Cart) private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly pricing: PricingService,
    private readonly tokens: CartPriceTokenService,
    private readonly gateway: StubGatewayDriver,
    private readonly notifications: NotificationService,
  ) {}

  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No retailer profile on this account');
    return profile;
  }

  private async notifyUser(userId: string, title: string, body: string, meta?: Record<string, unknown>) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;
    await this.notifications.notify({ toPhone: user.phone, title, body, meta });
  }

  /* ------------------------------- checkout ------------------------------- */

  async checkout(userId: string, dto: CheckoutDto) {
    const retailer = await this.requireRetailer(userId);
    if (!retailer.address) {
      throw new BadRequestException(
        'Add your shop address before checkout — deliveries need somewhere to go',
      );
    }

    const cart = await this.cartRepo.findOne({ where: { retailerProfileId: retailer.id } });
    if (!cart) throw new BadRequestException('Your cart is empty');

    const cartItems = await this.cartItemRepo.find({
      where: { cartId: cart.id },
      relations: { product: true },
    });
    if (cartItems.length === 0) throw new BadRequestException('Your cart is empty');

    // Gate 1: the token proves the retailer explicitly saw and accepted
    // exactly these lines via POST /cart/validate (PRD §9.2 point 1).
    const lines: PricedCartLine[] = cartItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      snapshotPrice: Number(i.snapshotPrice),
      snapshotMoq: i.snapshotMoq,
    }));
    const hash = this.tokens.hashLines(cart.id, lines);
    if (!this.tokens.verify(dto.confirmedPriceToken, hash)) {
      throw new BadRequestException(
        'Your cart changed since you last confirmed it — please review and confirm again',
      );
    }

    // Gate 2: re-validate live, right now, independently of the token
    // (PRD §9.2 point 2 — "place order" is its own recompute).
    const livePrices = await this.pricing.priceForMany(cartItems.map((i) => i.productId));
    for (const item of cartItems) {
      const live = livePrices.get(item.productId);
      const name = item.product?.name ?? 'An item';
      if (!live?.available) {
        throw new BadRequestException(`"${name}" just became unavailable — please review your cart`);
      }
      if (live.sellingPrice !== Number(item.snapshotPrice) || live.effectiveMoq !== item.snapshotMoq) {
        throw new BadRequestException(
          `"${name}" changed again just now — please review your cart and confirm once more`,
        );
      }
      if (item.quantity < live.effectiveMoq) {
        throw new BadRequestException(`${name}: minimum order quantity is ${live.effectiveMoq}`);
      }
    }

    const grandTotal = cartItems.reduce((sum, i) => sum + Number(i.snapshotPrice) * i.quantity, 0);

    const order = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);
      const paymentRepo = manager.getRepository(Payment);

      let savedOrder = await orderRepo.save(
        orderRepo.create({
          orderNumber: generateOrderNumber(),
          retailerProfileId: retailer.id,
          status: OrderStatus.PLACED,
          paymentMethod: dto.paymentMethod,
          paymentStatus: OrderPaymentStatus.PENDING,
          subtotal: grandTotal.toFixed(2),
          itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
          deliveryAddress: retailer.address!,
          confirmedPriceAt: new Date(),
        }),
      );

      for (const item of cartItems) {
        const product = item.product!;
        await orderItemRepo.save(
          orderItemRepo.create({
            orderId: savedOrder.id,
            productId: product.id,
            productNameSnapshot: product.name,
            packSizeSnapshot: formatPack(Number(product.packValue), product.packUnit),
            quantity: item.quantity,
            pricePerUnit: item.snapshotPrice,
            lineTotal: (Number(item.snapshotPrice) * item.quantity).toFixed(2),
          }),
        );
      }

      let paymentStatus = PaymentStatus.PENDING;
      let orderPaymentStatus = OrderPaymentStatus.PENDING;
      if (dto.paymentMethod === PaymentMethod.PREPAID) {
        const charge = await this.gateway.charge(grandTotal, savedOrder.id);
        paymentStatus = charge.success ? PaymentStatus.COLLECTED : PaymentStatus.FAILED;
        orderPaymentStatus = charge.success ? OrderPaymentStatus.PAID : OrderPaymentStatus.FAILED;
      }

      await paymentRepo.save(
        paymentRepo.create({
          orderId: savedOrder.id,
          method: dto.paymentMethod,
          amount: grandTotal.toFixed(2),
          status: paymentStatus,
        }),
      );

      savedOrder.paymentStatus = orderPaymentStatus;
      savedOrder = await orderRepo.save(savedOrder);

      await manager.getRepository(CartItem).delete({ cartId: cart.id });

      return savedOrder;
    });

    await this.notifyUser(
      userId,
      'Order placed',
      `Order ${order.orderNumber} placed for ₹${grandTotal.toFixed(2)}.`,
      { orderId: order.id },
    );

    return this.toOrderDetail(order);
  }

  /* -------------------------------- retailer ------------------------------- */

  async listMyOrders(userId: string, status?: OrderStatus) {
    const retailer = await this.requireRetailer(userId);
    const rows = await this.orders.find({
      where: status ? { retailerProfileId: retailer.id, status } : { retailerProfileId: retailer.id },
      order: { placedAt: 'DESC' },
    });
    return rows.map((o) => this.toOrderSummary(o));
  }

  async getOrderForRetailer(userId: string, orderId: string) {
    const retailer = await this.requireRetailer(userId);
    const order = await this.orders.findOne({ where: { id: orderId, retailerProfileId: retailer.id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderDetail(order);
  }

  /**
   * Cancellation is unconditional while PLACED for now — there is no cutoff
   * yet to make it the commitment point (D7 lands with batching, the next
   * plan). Once a batch/cutoff exists this must be gated on it.
   */
  async cancelOrder(userId: string, orderId: string) {
    const retailer = await this.requireRetailer(userId);
    const order = await this.orders.findOne({ where: { id: orderId, retailerProfileId: retailer.id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(`Order can no longer be cancelled (status: ${order.status})`);
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    await this.orders.save(order);

    return this.toOrderDetail(order);
  }

  /* --------------------------------- shared -------------------------------- */

  private toOrderSummary(o: Order) {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      subtotal: Number(o.subtotal),
      itemCount: o.itemCount,
      deliveryAddress: o.deliveryAddress,
      placedAt: o.placedAt,
      deliveredAt: o.deliveredAt ?? null,
      cancelledAt: o.cancelledAt ?? null,
    };
  }

  private async toOrderDetail(o: Order) {
    const items = await this.orderItems.find({ where: { orderId: o.id } });
    return {
      ...this.toOrderSummary(o),
      items: items.map((i) => ({
        id: i.id,
        productName: i.productNameSnapshot,
        packLabel: i.packSizeSnapshot,
        quantity: i.quantity,
        pricePerUnit: Number(i.pricePerUnit),
        lineTotal: Number(i.lineTotal),
      })),
    };
  }
}
```

Update the module:

```typescript
// backend/src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Product } from '../catalog/product.entity';
import { Payment } from '../wallet/payment.entity';
import { StubGatewayDriver } from '../wallet/payment-gateway.driver';
import { OrdersService } from './orders.service';
import { RetailerOrdersController } from './retailer-orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Cart, CartItem, RetailerProfile, User, Product, Payment]),
    PricingModule,
    CartModule,
    NotificationsModule,
  ],
  controllers: [RetailerOrdersController],
  providers: [OrdersService, StubGatewayDriver],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Delete `backend/src/orders/wholesaler-orders.controller.ts` — its `confirm`/`reject`/`pack` actions had no valid model to operate on once `Order.wholesalerProfileId` is gone; wholesaler-side fulfilment returns against `PurchaseOrder` in the next plan.

`backend/src/orders/retailer-orders.controller.ts` needs **no changes** — `checkout`/`listMine`/`getOne`/`cancel` already call `this.orders.checkout/listMyOrders/getOrderForRetailer/cancelOrder(...)` with exactly the signatures above.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/orders/orders.service.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/orders
git rm backend/src/orders/wholesaler-orders.controller.ts
git commit -m "feat(orders): single customer order at checkout, drop Udhaar + wholesaler fan-out"
```

---

## Task 5: Delivery service — drop Udhaar draw and the stale wholesaler-listing coupling

**Files:**
- Modify: `backend/src/delivery/delivery.service.ts`
- Modify: `backend/src/delivery/delivery.module.ts`
- Test: `backend/src/delivery/delivery.service.spec.ts`

**Interfaces:**
- Consumes: `Order` (Task 4's shape — no `wholesalerProfile`).
- Produces: no change to `DeliveryService`'s public method names/signatures (`listUnassigned/listPartners/assign/listMine/pickedUp/delivered/failed`), so `admin-delivery.controller.ts` / `rider-delivery.controller.ts` need **no changes**.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/delivery/delivery.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliveryService } from './delivery.service';
import { Delivery, DeliveryStatus } from './delivery.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from '../orders/order.entity';
import { Payment, PaymentStatus } from '../wallet/payment.entity';
import { NotificationService } from '../notifications/notification.service';

const RIDER_ID = 'rider-1';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let order: Order;
  let delivery: Delivery;
  let payment: Payment | null;

  beforeEach(async () => {
    order = {
      id: 'order-1',
      orderNumber: 'MB-2026-TEST01',
      retailerProfileId: 'retailer-1',
      status: OrderStatus.PICKED_UP,
      paymentMethod: PaymentMethod.COD,
      paymentStatus: OrderPaymentStatus.PENDING,
      subtotal: '501.60',
    } as Order;
    delivery = {
      id: 'delivery-1',
      orderId: order.id,
      order,
      deliveryPartnerId: RIDER_ID,
      status: DeliveryStatus.PICKED_UP,
    } as Delivery;
    payment = { id: 'payment-1', orderId: order.id, status: PaymentStatus.PENDING } as Payment;

    const fakeManager = {
      getRepository: (entity: any) => {
        if (entity === Delivery) return { save: async (v: Delivery) => Object.assign(delivery, v) };
        if (entity === Order) {
          return {
            findOneOrFail: async () => order,
            save: async (v: Order) => Object.assign(order, v),
          };
        }
        if (entity === Payment) {
          return {
            findOne: async () => payment,
            save: async (v: Payment) => Object.assign(payment!, v),
          };
        }
        throw new Error(`Unexpected repository requested: ${entity}`);
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: DataSource, useValue: { transaction: async (fn: any) => fn(fakeManager) } },
        { provide: getRepositoryToken(Delivery), useValue: { findOne: async () => delivery } },
        {
          provide: getRepositoryToken(DeliveryPartnerProfile),
          useValue: { findOne: async () => ({ id: RIDER_ID, userId: 'user-rider' }) },
        },
        { provide: getRepositoryToken(MandiAdminProfile), useValue: { findOne: async () => null } },
        { provide: getRepositoryToken(RetailerProfile), useValue: { findOne: async () => ({ id: 'retailer-1', userId: 'user-retailer' }) } },
        { provide: getRepositoryToken(User), useValue: { findOne: async () => ({ id: 'user-x', phone: '9000000001' }) } },
        { provide: getRepositoryToken(Order), useValue: { findOne: async () => order } },
        { provide: getRepositoryToken(Payment), useValue: {} },
        { provide: NotificationService, useValue: { notify: async () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(DeliveryService);
  });

  it('COD delivery collects payment and marks the order paid', async () => {
    const view = await service.delivered('user-rider', 'delivery-1', {});
    expect(payment!.status).toBe(PaymentStatus.COLLECTED);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(view.status).toBe(DeliveryStatus.DELIVERED);
  });

  it('prepaid delivery leaves payment untouched (already settled at checkout)', async () => {
    order.paymentMethod = PaymentMethod.PREPAID;
    order.paymentStatus = OrderPaymentStatus.PAID;
    payment!.status = PaymentStatus.COLLECTED;
    await service.delivered('user-rider', 'delivery-1', {});
    expect(payment!.status).toBe(PaymentStatus.COLLECTED);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PAID);
  });

  it('never renders a wholesaler name on the delivery view', async () => {
    const view = await service.delivered('user-rider', 'delivery-1', {});
    expect(view.order).not.toHaveProperty('wholesalerName');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/delivery/delivery.service.spec.ts`
Expected: FAIL — current `delivery.service.ts` requires `WholesalerListing`/`OrderItem`/`UdhaarAccount`/`UdhaarTransaction` repositories this test doesn't provide, and reads `order.wholesalerProfile`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/delivery/delivery.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './delivery.entity';
import { DeliveryPartnerProfile, DeliveryPartnerStatus } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from '../orders/order.entity';
import { Payment, PaymentStatus } from '../wallet/payment.entity';
import { NotificationService } from '../notifications/notification.service';
import { AssignDeliveryDto, FailDeliveryDto, MarkDeliveredDto } from './dto/delivery.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    @InjectRepository(DeliveryPartnerProfile)
    private readonly partners: Repository<DeliveryPartnerProfile>,
    @InjectRepository(MandiAdminProfile)
    private readonly mandiAdmins: Repository<MandiAdminProfile>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly notifications: NotificationService,
  ) {}

  private async requireMandiAdmin(userId: string): Promise<MandiAdminProfile> {
    const profile = await this.mandiAdmins.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No Mandi Admin profile on this account');
    return profile;
  }

  private async requireRider(userId: string): Promise<DeliveryPartnerProfile> {
    const profile = await this.partners.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No delivery partner profile on this account');
    return profile;
  }

  private async notifyUser(userId: string, title: string, body: string, meta?: Record<string, unknown>) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;
    await this.notifications.notify({ toPhone: user.phone, title, body, meta });
  }

  private async notifyRetailerFor(order: Order, title: string, body: string) {
    const retailer = await this.retailers.findOne({ where: { id: order.retailerProfileId } });
    if (retailer) await this.notifyUser(retailer.userId, title, body, { orderId: order.id });
  }

  /* ------------------------------ mandi admin ------------------------------ */

  async listUnassigned(userId: string) {
    const admin = await this.requireMandiAdmin(userId);
    const rows = await this.deliveries.find({
      where: { mandiId: admin.mandiId, status: DeliveryStatus.UNASSIGNED },
      relations: { order: { retailerProfile: true } },
      order: { createdAt: 'ASC' },
    });
    return rows.map((d) => this.toDeliveryView(d));
  }

  async listPartners(userId: string) {
    const admin = await this.requireMandiAdmin(userId);
    const rows = await this.partners.find({
      where: { mandiId: admin.mandiId, status: DeliveryPartnerStatus.ACTIVE },
      order: { name: 'ASC' },
    });
    return rows.map((p) => ({ id: p.id, name: p.name, vehicleInfo: p.vehicleInfo ?? null }));
  }

  async assign(userId: string, deliveryId: string, dto: AssignDeliveryDto) {
    const admin = await this.requireMandiAdmin(userId);
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId, mandiId: admin.mandiId },
      relations: { order: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== DeliveryStatus.UNASSIGNED) {
      throw new BadRequestException(`Delivery already ${delivery.status}`);
    }

    const partner = await this.partners.findOne({
      where: { id: dto.deliveryPartnerId, mandiId: admin.mandiId, status: DeliveryPartnerStatus.ACTIVE },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found in your mandi');

    delivery.deliveryPartnerId = partner.id;
    delivery.status = DeliveryStatus.ASSIGNED;
    delivery.assignedAt = new Date();
    await this.deliveries.save(delivery);

    const order = delivery.order;
    order.status = OrderStatus.ASSIGNED;
    await this.orders.save(order);

    await this.notifyUser(
      partner.userId,
      'New delivery assigned',
      `Pick up order ${order.orderNumber} and deliver it — see your Deliveries list.`,
      { deliveryId: delivery.id },
    );
    await this.notifyRetailerFor(order, 'Rider assigned', `${partner.name} will deliver order ${order.orderNumber}.`);

    return this.toDeliveryView(delivery, order);
  }

  /* ---------------------------------- rider --------------------------------- */

  async listMine(userId: string) {
    const rider = await this.requireRider(userId);
    const rows = await this.deliveries.find({
      where: { deliveryPartnerId: rider.id },
      relations: { order: { retailerProfile: true } },
      order: { assignedAt: 'DESC' },
    });
    return rows.map((d) => this.toDeliveryView(d));
  }

  private async requireOwnedByRider(riderId: string, deliveryId: string) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId, deliveryPartnerId: riderId },
      relations: { order: { retailerProfile: true } },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async pickedUp(userId: string, deliveryId: string) {
    const rider = await this.requireRider(userId);
    const delivery = await this.requireOwnedByRider(rider.id, deliveryId);
    if (delivery.status !== DeliveryStatus.ASSIGNED) {
      throw new BadRequestException(`Delivery can't be marked picked up (status: ${delivery.status})`);
    }

    delivery.status = DeliveryStatus.PICKED_UP;
    delivery.pickedUpAt = new Date();
    await this.deliveries.save(delivery);

    delivery.order.status = OrderStatus.PICKED_UP;
    await this.orders.save(delivery.order);

    await this.notifyRetailerFor(delivery.order, 'Order picked up', `${delivery.order.orderNumber} is on its way to you.`);
    return this.toDeliveryView(delivery, delivery.order);
  }

  async delivered(userId: string, deliveryId: string, dto: MarkDeliveredDto) {
    const rider = await this.requireRider(userId);
    const delivery = await this.requireOwnedByRider(rider.id, deliveryId);
    if (![DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP].includes(delivery.status)) {
      throw new BadRequestException(`Delivery can't be marked delivered (status: ${delivery.status})`);
    }

    const order = await this.dataSource.transaction(async (manager) => {
      const deliveryRepo = manager.getRepository(Delivery);
      const orderRepo = manager.getRepository(Order);
      const paymentRepo = manager.getRepository(Payment);

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
      await deliveryRepo.save(delivery);

      const freshOrder = await orderRepo.findOneOrFail({ where: { id: delivery.orderId } });
      freshOrder.status = OrderStatus.DELIVERED;
      freshOrder.deliveredAt = new Date();

      if (freshOrder.paymentMethod === PaymentMethod.COD) {
        const payment = await paymentRepo.findOne({ where: { orderId: freshOrder.id } });
        const collected = dto.paymentCollected !== false;
        if (payment && collected) {
          payment.status = PaymentStatus.COLLECTED;
          payment.collectedAt = new Date();
          payment.collectedByDeliveryPartnerId = rider.id;
          await paymentRepo.save(payment);
          freshOrder.paymentStatus = OrderPaymentStatus.PAID;
        }
        // If not collected, payment/order payment status stay pending —
        // a manual follow-up is needed (no automated dunning in v1).
      }
      // Prepaid orders are already settled at checkout (StubGatewayDriver) —
      // nothing to collect on delivery.

      await orderRepo.save(freshOrder);
      return freshOrder;
    });

    await this.notifyRetailerFor(order, 'Order delivered', `${order.orderNumber} has been delivered.`);
    return this.toDeliveryView(delivery, order);
  }

  async failed(userId: string, deliveryId: string, dto: FailDeliveryDto) {
    const rider = await this.requireRider(userId);
    const delivery = await this.requireOwnedByRider(rider.id, deliveryId);
    if (![DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP].includes(delivery.status)) {
      throw new BadRequestException(`Delivery can't be marked failed (status: ${delivery.status})`);
    }

    delivery.status = DeliveryStatus.FAILED;
    delivery.failedAt = new Date();
    delivery.failureReason = dto.reason;
    await this.deliveries.save(delivery);

    const order = delivery.order;
    order.status = OrderStatus.DELIVERY_FAILED;
    await this.orders.save(order);

    // Stock release on a failed delivery will be reintroduced once
    // sourcing/stock reservation exists at the PurchaseOrder layer (next
    // plan) — nothing is reserved against a wholesaler at checkout anymore.

    await this.notifyRetailerFor(order, 'Delivery failed', `${order.orderNumber} could not be delivered: ${dto.reason}`);
    return this.toDeliveryView(delivery, order);
  }

  private toDeliveryView(d: Delivery, orderOverride?: Order) {
    const order = orderOverride ?? d.order;
    return {
      id: d.id,
      status: d.status,
      order: order
        ? {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            subtotal: Number(order.subtotal),
            deliveryAddress: order.deliveryAddress,
            retailerName: order.retailerProfile?.shopName ?? null,
            paymentMethod: order.paymentMethod,
          }
        : null,
      assignedAt: d.assignedAt ?? null,
      pickedUpAt: d.pickedUpAt ?? null,
      deliveredAt: d.deliveredAt ?? null,
      failedAt: d.failedAt ?? null,
      failureReason: d.failureReason ?? null,
    };
  }
}
```

```typescript
// backend/src/delivery/delivery.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './delivery.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order } from '../orders/order.entity';
import { Payment } from '../wallet/payment.entity';
import { DeliveryService } from './delivery.service';
import { AdminDeliveryController } from './admin-delivery.controller';
import { RiderDeliveryController } from './rider-delivery.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, DeliveryPartnerProfile, MandiAdminProfile, RetailerProfile, User, Order, Payment]),
    NotificationsModule,
  ],
  controllers: [AdminDeliveryController, RiderDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
```

`admin-delivery.controller.ts` and `rider-delivery.controller.ts` need **no changes** — all method names/signatures are unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/delivery/delivery.service.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/delivery
git commit -m "fix(delivery): drop Udhaar draw and stale wholesaler-listing coupling"
```

---

## Task 6: Delete the Udhaar/wallet feature (entities parked, everything else removed)

**Files:**
- Delete: `backend/src/wallet/wallet.service.ts`
- Delete: `backend/src/wallet/wallet.controller.ts`
- Delete: `backend/src/wallet/admin-wallet.controller.ts`
- Delete: `backend/src/wallet/wallet.module.ts`
- Delete: `backend/src/wallet/dto/wallet.dto.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: nothing — this task only removes now-orphaned code. `UdhaarAccount`/`UdhaarTransaction` entities are untouched and stay registered (table retained, PRD §9.4).

- [ ] **Step 1: Confirm nothing still references the files being deleted**

Run: `cd backend && grep -rln "wallet.service\|wallet.controller\|admin-wallet.controller\|wallet.module\|wallet.dto\|WalletService\|WalletController\|AdminWalletController\|WalletModule" src`
Expected: only the files inside `backend/src/wallet/` themselves (the ones about to be deleted) — Tasks 4 and 5 already removed every external reference (`orders.service.ts`'s Udhaar credit check, `delivery.service.ts`'s Udhaar draw, `app.module.ts`'s `WalletModule` import is fixed in this task).

- [ ] **Step 2: Delete the files**

```bash
git rm backend/src/wallet/wallet.service.ts backend/src/wallet/wallet.controller.ts backend/src/wallet/admin-wallet.controller.ts backend/src/wallet/wallet.module.ts backend/src/wallet/dto/wallet.dto.ts
```

- [ ] **Step 3: Update app.module.ts**

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MandisModule } from './mandis/mandis.module';
import { CatalogModule } from './catalog/catalog.module';
import { ListingsModule } from './listings/listings.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveryModule } from './delivery/delivery.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PricingModule } from './pricing/pricing.module';
import { User } from './entities/user.entity';
import { RetailerProfile } from './entities/retailer-profile.entity';
import { WholesalerProfile } from './entities/wholesaler-profile.entity';
import { MandiAdminProfile } from './entities/mandi-admin-profile.entity';
import { DeliveryPartnerProfile } from './entities/delivery-partner-profile.entity';
import { SuperAdminProfile } from './entities/super-admin-profile.entity';
import { ProductMarkup } from './pricing/product-markup.entity';
import { Mandi } from './mandis/mandi.entity';
import { OtpRequest } from './auth/otp-request.entity';
import { Category } from './catalog/category.entity';
import { Product } from './catalog/product.entity';
import { ProductAlias } from './catalog/product-alias.entity';
import { WholesalerListing } from './listings/wholesaler-listing.entity';
import { Cart } from './cart/cart.entity';
import { CartItem } from './cart/cart-item.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { Delivery } from './delivery/delivery.entity';
import { UdhaarAccount } from './wallet/udhaar-account.entity';
import { UdhaarTransaction } from './wallet/udhaar-transaction.entity';
import { Payment } from './wallet/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'mandibhai'),
        password: config.get<string>('DB_PASSWORD', 'mandibhai_dev_pw'),
        database: config.get<string>('DB_NAME', 'mandibhai'),
        entities: [
          User,
          RetailerProfile,
          WholesalerProfile,
          MandiAdminProfile,
          DeliveryPartnerProfile,
          SuperAdminProfile,
          ProductMarkup,
          Mandi,
          OtpRequest,
          Category,
          Product,
          ProductAlias,
          WholesalerListing,
          Cart,
          CartItem,
          Order,
          OrderItem,
          Delivery,
          // Parked, not deleted — PRD §9.4: table retained, no write path, no
          // UI. Kept registered so the schema (and the vision-tier ledger
          // design) survive; nothing in the codebase writes to these anymore.
          UdhaarAccount,
          UdhaarTransaction,
          Payment,
        ],
        // Dev-only convenience: auto-creates/updates tables from entities.
        // Switch to TypeORM migrations before this touches real data (TODO.md).
        synchronize: true,
      }),
    }),
    HealthModule,
    AuthModule,
    MandisModule,
    CatalogModule,
    PricingModule,
    ListingsModule,
    CartModule,
    OrdersModule,
    DeliveryModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Verify the whole backend still compiles and every test passes**

Run: `cd backend && npx tsc --noEmit && npx jest`
Expected: zero TypeScript errors, all suites pass (Tasks 1–5's specs plus the pre-existing `app.controller.spec.ts` and `pricing.service.spec.ts`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "chore(wallet): remove Udhaar/wallet feature, keep parked entities registered"
```

---

## Task 7: API docs and context sync

**Files:**
- Create: `docs/API.md`
- Modify: `TODO.md`
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write `docs/API.md`**

```markdown
# Mandi Bhai — API Reference

Reflects the backend as of Phase 0 / Plan A (cart & checkout foundation). This
is a living document — update it in the same commit as any endpoint change.
See `PRD.md` §15 for the full target API surface across every phase; this
file documents what actually exists **right now**, not the target.

Base URL: `http://localhost:3000` (or `EXPO_PUBLIC_API_URL` on device).
Auth: `Authorization: Bearer <jwt>` from `POST /auth/otp/verify`, except
where noted public.

## Auth (`auth/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/otp/request` | public | Dev-stubbed — OTP returned in the response (`devOtp`), also logged |
| POST | `/auth/otp/verify` | public | Returns JWT + every profile on the account |
| POST | `/auth/profile` | authenticated | Creates a role profile (retailer/wholesaler) for the current user |

## Mandis (`mandis/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/mandis` | public | List of seeded mandis |

## Catalogue (`catalog/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/categories` | public | |
| GET | `/products` | public | Paginated search; each row's `offer` is the anonymised platform price (`sellingPrice`, `mandiAverage`, `savingsVsAverage`, `moq`, `stockStatus`) — never a wholesaler name or raw quote |
| GET | `/products/:id` | public | Single product + its `offer` block |
| POST/PATCH `/admin/*` | super_admin | Master catalogue CRUD — see `admin-catalog.controller.ts` |

## Pricing (`pricing/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/super-admin/pricing/products/:id` | super_admin | Every quote, min/avg/spread, markup, selling price, margin — the one surface where cost/margin are visible (PRD §2.2) |
| PUT | `/super-admin/pricing/products/:id/markup` | super_admin | Set `percent` and optional `moqOverride` |

## Cart (`cart/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/cart` | retailer | Read-only. Diffs each line's stored snapshot against a fresh live price; `priceChanged`/`moqChanged`/`belowMoq`/`unavailable` flags per item, `canCheckout` overall. Never mutates. |
| POST | `/cart/items` | retailer | Body `{ productId, quantity }`. Prices via `PricingService`, snapshots the line |
| PATCH | `/cart/items/:id` | retailer | Body `{ quantity }`. Never re-prices |
| DELETE | `/cart/items/:id` | retailer | |
| POST | `/cart/validate` | retailer | Re-prices every line, **syncs** each snapshot to the live figures, and — only if every line is then clean — returns `confirmedPriceToken` (short-lived, ~10 min). Call this right before checkout |

## Checkout & Orders (`orders/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/checkout` | retailer | Body `{ paymentMethod: 'cod'\|'prepaid', confirmedPriceToken }`. Verifies the token against the cart's current snapshots, re-checks live pricing independently, then creates **one** `Order` + line items + one `Payment` and clears the cart. `prepaid` runs through the stubbed gateway (`StubGatewayDriver`, always succeeds in dev) |
| GET | `/orders` | retailer | My orders, optional `?status=` |
| GET | `/orders/:id` | retailer | |
| POST | `/orders/:id/cancel` | retailer | Allowed only while `status = placed`. **Interim behaviour** — there is no cutoff yet, so this is not yet gated on one (PRD D7 lands with cutoff batching) |

**Not yet built:** wholesaler-facing order/PO management (`wholesaler/orders*` was removed — it operated on the old per-wholesaler `Order` shape, which no longer exists; a `PurchaseOrder`-based replacement lands with the allocation engine).

## Delivery (`delivery/`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/admin/deliveries/unassigned` | mandi_admin | |
| GET | `/admin/deliveries/partners` | mandi_admin | |
| POST | `/admin/deliveries/:id/assign` | mandi_admin | |
| GET | `/rider/deliveries` | delivery_partner | |
| POST | `/rider/deliveries/:id/picked-up` | delivery_partner | |
| POST | `/rider/deliveries/:id/delivered` | delivery_partner | Body `{ paymentCollected? }` — COD only; prepaid orders are already settled at checkout |
| POST | `/rider/deliveries/:id/failed` | delivery_partner | Body `{ reason }` |

**Known gap:** nothing currently creates a `Delivery` row — the old trigger (`wholesaler marks packed`) was removed along with the per-wholesaler order model, and its replacement (PO pickup → delivery) lands with the allocation engine. These endpoints are correct but presently unreachable in practice.

## Removed in this plan

- `GET /wallet/me`, `PATCH /admin/wallet/:id/limit`, `POST /admin/wallet/:id/repayment` — Udhaar descoped (PRD §9.4). `UdhaarAccount`/`UdhaarTransaction` tables are retained but unwritten.
- `wholesaler/orders*` (list/confirm/reject/pack) — operated on the old per-wholesaler `Order`; superseded by a `PurchaseOrder` surface in the next plan.
```

- [ ] **Step 2: Update `TODO.md`**

Make these edits to `TODO.md` (do not rewrite the whole file — these are targeted corrections):

1. Remove the `- [ ] **SMS OTP delivery is stubbed.**` item's neighbours are untouched; leave Auth/Users section as-is (still accurate).
2. In the "Listings / pricing" section, the `MOQ is captured...` line is stale per PRD §4.3 — replace it:

   Old: `- [ ] MOQ is captured and displayed but nothing enforces it yet (enforcement belongs to the cart).`

   New: `- [ ] MOQ is enforced at cart-validate and checkout (both re-check live MOQ), but there is still no automatic allocation engine — sourcing/MOQ-fit at batch time is unbuilt (see PLAN doc for the pivot, PRD §10).`
3. Add a new section after "## Database":

   ```markdown
   ## Orders / Checkout (pivot in progress — see `docs/superpowers/plans/2026-08-14-phase0-plan-a-cart-checkout-foundation.md`)
   - [x] ~~Retailer picks a wholesaler per listing.~~ Checkout now creates one
         customer `Order`, no wholesaler chosen — sourcing is deferred entirely.
   - [ ] **No allocation/sourcing engine yet.** Nothing assigns a wholesaler to
         a placed order. The next plan adds `PurchaseOrder`, the cheapest-
         in-stock-meeting-MOQ allocator, and re-source-on-shortfall.
   - [ ] **No cutoff/batching yet.** `Order.cancelOrder` allows cancellation
         any time the order is `placed` — there is no cutoff to make that the
         commitment point (PRD D7). Do not treat this as final behaviour.
   - [ ] **Wholesaler-side order management was removed**, not rebuilt.
         `wholesaler/orders*` operated on the old per-wholesaler `Order` shape;
         its replacement is a `PurchaseOrder` surface, not yet built.
   - [ ] **Delivery creation has no trigger.** The old one (`wholesaler marks
         packed`) was removed with the wholesaler order flow. Nothing currently
         creates a `Delivery` row.
   - [ ] Udhaar/wallet fully removed from checkout and delivery. `PaymentMethod`
         is `cod | prepaid`; prepaid runs through a stub gateway
         (`StubGatewayDriver`) that always succeeds in dev — no real gateway
         wired up.
   ```
4. Under "## Infra", the existing `No CI/CD...` and storage lines stay; do not add anything else here (out of this plan's scope).

- [ ] **Step 3: Update `CLAUDE.md`**

In the "Architecture → Backend" section, replace these two bullets:

Old:
```
- `cart/` — retailer's cart, items reference a `WholesalerListing` directly (not just a product), validated against live MOQ/stock.
- `orders/` — checkout fans a cart out into **one `Order` per distinct wholesaler** (never one order per cart), because each wholesaler packs and hands off independently. Checkout row-locks (`pessimistic_write`, sorted by id to avoid deadlocks) each listing and decrements stock inside the same transaction that creates the order.
```

New:
```
- `cart/` — retailer's cart references a master `Product`, not a wholesaler's listing (the retailer buys from the platform, never a chosen supplier). Prices live through `PricingService`; `CartItem` snapshots `{price, moq}` at add-time and `POST /cart/validate` re-syncs the snapshot and issues a short-lived `confirmedPriceToken` (`cart-price-token.service.ts`, stateless HMAC — no table) that checkout re-verifies.
- `orders/` — checkout creates **one customer `Order`** per checkout (never a fan-out) — no wholesaler is chosen at this point. Checkout re-validates price/MOQ live a second time (independent of the token) before creating the order, matching PRD §9.2's two-point re-validation. Sourcing a wholesaler against a `PurchaseOrder` is not built yet — that's the allocation engine, a later plan.
```

Also replace the `wallet/` bullet:

Old:
```
- `wallet/` — Udhaar (credit) account + ledger (`UdhaarTransaction`, not just a balance, for auditability) plus `Payment` (kept separate from `Order` so an online gateway can slot in later without a schema change). Credit-limit is checked at checkout but the `draw` ledger entry posts at actual delivery time, not at order placement.
```

New:
```
- `wallet/` — holds `Payment` (kept separate from `Order` so a gateway can slot in without a schema change) and `payment-gateway.driver.ts` (`StubGatewayDriver`, same stub-now-swap-later pattern as `NotificationService`). Udhaar (`UdhaarAccount`/`UdhaarTransaction`) is descoped from v1 — the entities stay registered so the table/ledger design survive, but nothing writes to them. `PaymentMethod` is `cod | prepaid`.
```

Also update the "Cross-cutting pattern" paragraph's last sentence (stock release), since checkout no longer touches wholesaler stock at all in this plan:

Old: `Stock is released (incremented back) on any path where an order ends without reaching \`delivered\`: wholesaler reject, retailer cancel, delivery failure.`

New: `Stock reservation/release against a specific wholesaler does not happen at checkout anymore — no wholesaler is chosen until the (not-yet-built) allocation engine runs. This line will be re-added once that exists.`

- [ ] **Step 4: Verify docs are self-consistent**

Read back `docs/API.md`, the edited sections of `TODO.md`, and `CLAUDE.md` and confirm: no leftover reference to `wholesaler/orders*` as if it still exists outside the explicit "removed" notes, no leftover reference to Udhaar as a live write path, and every endpoint in `docs/API.md` matches a route actually present in Tasks 1–6's controllers.

- [ ] **Step 5: Commit**

```bash
git add docs/API.md TODO.md CLAUDE.md
git commit -m "docs: add API reference, sync TODO/CLAUDE to the cart-checkout pivot"
```

---

## Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Type-check and build**

Run: `cd backend && npx tsc --noEmit && npm run build`
Expected: zero errors.

- [ ] **Step 2: Full test suite**

Run: `cd backend && npm test`
Expected: all suites pass — `app.controller.spec.ts`, `pricing.service.spec.ts`, `cart-price-token.service.spec.ts`, `cart.service.spec.ts`, `payment-gateway.driver.spec.ts`, `orders.service.spec.ts`, `delivery.service.spec.ts`.

- [ ] **Step 3: Lint**

Run: `cd backend && npm run lint`
Expected: no new errors introduced by this plan (pre-existing warnings elsewhere are out of scope).

- [ ] **Step 4: Seed still runs clean against a fresh database**

Run:
```bash
docker compose up -d postgres
cd backend && npm run start:dev &  # let synchronize create tables, then Ctrl+C or leave running
npm run seed
```
Expected: `Seed complete.` with no errors — this plan does not touch any entity `seed.ts` writes to, so this is a regression check, not new work.

- [ ] **Step 5: Manual smoke test of the full cart → checkout → cancel loop**

With the backend running and seeded, run:

```bash
# 1. Request + verify OTP for a seeded retailer (9000000001), grab the JWT from the response.
curl -s -X POST localhost:3000/auth/otp/request -H 'content-type: application/json' -d '{"phone":"9000000001"}'
curl -s -X POST localhost:3000/auth/otp/verify -H 'content-type: application/json' -d '{"phone":"9000000001","otp":"<devOtp from above>"}'

# 2. Find a product id.
curl -s localhost:3000/products | head -c 500

# 3. Add it to cart (as the retailer, with the JWT).
TOKEN=<jwt from step 1>
PRODUCT=<id from step 2>
curl -s -X POST localhost:3000/cart/items -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"productId\":\"$PRODUCT\",\"quantity\":12}"

# 4. Validate — grab confirmedPriceToken.
curl -s -X POST localhost:3000/cart/validate -H "authorization: Bearer $TOKEN"

# 5. Checkout with that token.
TOKEN2=<confirmedPriceToken from step 4>
curl -s -X POST localhost:3000/checkout -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"paymentMethod\":\"cod\",\"confirmedPriceToken\":\"$TOKEN2\"}"

# 6. List orders, cancel it.
curl -s localhost:3000/orders -H "authorization: Bearer $TOKEN"
ORDER_ID=<id from step 6>
curl -s -X POST localhost:3000/orders/$ORDER_ID/cancel -H "authorization: Bearer $TOKEN"
```

Expected: step 3 returns a cart with one item and `pricePerUnit` matching the product's live selling price; step 4 returns `confirmedPriceToken` non-null with `canCheckout: true`; step 5 returns a single order (not an array) with no `wholesalerName` anywhere in the payload; step 6's cancel returns `status: "cancelled"`.

- [ ] **Step 6: Confirm no supplier-identity leak survives in any retailer-facing payload touched by this plan**

Run: `cd backend && grep -rn "wholesalerName\|wholesalerProfileId\|wholesalerListingId\|wholesalerGroups" src/cart src/orders/orders.service.ts src/orders/order.entity.ts src/orders/order-item.entity.ts src/orders/dto`
Expected: no matches (delivery admin/rider views intentionally still carry no supplier data either, since `Order` has none to carry — full admin/rider supplier visibility is restored once `PurchaseOrder` exists).

This task has no commit of its own — if any step surfaces a problem, fix it as part of the task where the bug was introduced (amend that task's code, not a new patch commit), then re-run the full sequence from Step 1.

---

## Self-Review

**Spec coverage.** PRD §9.1 (two-object model) — partially: the customer-order half is built, `PurchaseOrder` is explicitly out of scope (next plan, stated in the Architecture section). §9.2 (re-validation) — Task 2 + Task 4's two gates. §9.3 tiers — cart tier's "Next" column items (productId not listing, no supplier grouping, price snapshot + delta, confirmation gate) are all done except "MOQ-increase gate with quantity-raise prompt" and "cutoff countdown" and "no cancellation after cutoff notice", which are frontend/cutoff-dependent and correctly deferred. §9.4 Udhaar descope — Task 4 + Task 5 + Task 6 cover every row of the disposition table except `WalletScreen` removal (frontend, a separate plan) and the `Payment.method` extension (done — `cod | prepaid`). §4.1 L3/L4/L7 (supplier-identity leaks in cart/order) — fixed. §4.2 S4 (cart→productId), S16 (`PaymentMethod`) — fixed. S15 (order lifecycle split) — partially: wholesaler/PO states correctly deferred, customer lifecycle simplified to what's reachable.

**Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N" language anywhere above; every step has real, complete code.

**Type consistency.** `PricedCartLine` (Task 1) is the same shape consumed in Task 2 (`cart.service.ts`) and Task 4 (`orders.service.ts`) — checked field-by-field. `CheckoutDto.confirmedPriceToken` (Task 4) matches what `CartService.validate()` (Task 2) returns as `confirmedPriceToken`. `StubGatewayDriver.charge(amount: number, orderId: string)` (Task 3) matches its one call site in Task 4. `OrdersService`'s injected `StubGatewayDriver` is registered as a provider in `OrdersModule` (Task 4), not re-declared elsewhere. `DeliveryService`'s constructor drops `OrderItem`/`WholesalerListing`/`UdhaarAccount`/`UdhaarTransaction` (Task 5) and `delivery.module.ts`'s `TypeOrmModule.forFeature` is updated to match exactly (no orphaned repository tokens).

**Scope check.** This is one coherent, independently shippable subsystem: cart, checkout, and the Udhaar removal that's structurally entangled with both. Allocation/sourcing, cutoff batching, product audit, and the frontend are each their own later plan — deliberately not folded in here, per the "don't create unnecessary [code for unreachable states]" constraint and to keep this plan reviewable as one unit.

## Known, deliberate gaps after this plan (not bugs — next plan's scope)

- No wholesaler is ever chosen. `Order` has no supplier, no `PurchaseOrder` exists, `PricingService.sourceFor()` (already built, unused) is not called from anywhere.
- No cutoff/batching. `cancelOrder` allows cancellation any time the order is `placed`.
- No `Delivery` row is ever created (the old creation trigger was removed with the wholesaler order flow).
- `wholesaler/orders*` no longer exists; wholesalers currently have no way to see incoming demand from the app.
- Frontend (`frontend/src/api/client.ts` and every screen touching cart/checkout/wallet) is untouched and will not compile against these API changes until the frontend plan runs.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-phase0-plan-a-cart-checkout-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans
- Batch execution with checkpoints for review
