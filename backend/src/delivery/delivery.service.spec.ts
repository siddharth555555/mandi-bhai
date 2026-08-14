import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliveryService } from './delivery.service';
import { Delivery, DeliveryStatus } from './delivery.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import {
  Order,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
} from '../orders/order.entity';
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
    payment = {
      id: 'payment-1',
      orderId: order.id,
      status: PaymentStatus.PENDING,
    } as Payment;

    const fakeManager = {
      getRepository: (entity: any) => {
        if (entity === Delivery)
          return { save: async (v: Delivery) => Object.assign(delivery, v) };
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
        {
          provide: DataSource,
          useValue: { transaction: async (fn: any) => fn(fakeManager) },
        },
        {
          provide: getRepositoryToken(Delivery),
          useValue: { findOne: async () => delivery },
        },
        {
          provide: getRepositoryToken(DeliveryPartnerProfile),
          useValue: {
            findOne: async () => ({ id: RIDER_ID, userId: 'user-rider' }),
          },
        },
        {
          provide: getRepositoryToken(MandiAdminProfile),
          useValue: { findOne: async () => null },
        },
        {
          provide: getRepositoryToken(RetailerProfile),
          useValue: {
            findOne: async () => ({
              id: 'retailer-1',
              userId: 'user-retailer',
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: async () => ({ id: 'user-x', phone: '9000000001' }),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: { findOne: async () => order },
        },
        {
          provide: NotificationService,
          useValue: { notify: async () => undefined },
        },
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
