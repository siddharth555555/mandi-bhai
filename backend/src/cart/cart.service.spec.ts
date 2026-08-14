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
