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
    expect(detail.subtotal).toBe(Number((41.8 * 12).toFixed(2)));
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
