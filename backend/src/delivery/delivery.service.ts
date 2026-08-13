import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './delivery.entity';
import {
  DeliveryPartnerProfile,
  DeliveryPartnerStatus,
} from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { Payment, PaymentStatus } from '../wallet/payment.entity';
import { UdhaarAccount } from '../wallet/udhaar-account.entity';
import { UdhaarTransaction, UdhaarTransactionType } from '../wallet/udhaar-transaction.entity';
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
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(WholesalerListing)
    private readonly listings: Repository<WholesalerListing>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(UdhaarAccount)
    private readonly udhaarAccounts: Repository<UdhaarAccount>,
    @InjectRepository(UdhaarTransaction)
    private readonly udhaarTransactions: Repository<UdhaarTransaction>,
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
      relations: { order: { retailerProfile: true, wholesalerProfile: true } },
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
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      vehicleInfo: p.vehicleInfo ?? null,
    }));
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
    await this.notifyRetailerFor(
      order,
      'Rider assigned',
      `${partner.name} will deliver order ${order.orderNumber}.`,
    );

    return this.toDeliveryView(delivery, order);
  }

  /* ---------------------------------- rider --------------------------------- */

  async listMine(userId: string) {
    const rider = await this.requireRider(userId);
    const rows = await this.deliveries.find({
      where: { deliveryPartnerId: rider.id },
      relations: { order: { retailerProfile: true, wholesalerProfile: true } },
      order: { assignedAt: 'DESC' },
    });
    return rows.map((d) => this.toDeliveryView(d));
  }

  private async requireOwnedByRider(riderId: string, deliveryId: string) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId, deliveryPartnerId: riderId },
      relations: { order: { retailerProfile: true, wholesalerProfile: true } },
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

    await this.notifyRetailerFor(
      delivery.order,
      'Order picked up',
      `${delivery.order.orderNumber} is on its way to you.`,
    );
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

      const payment = await paymentRepo.findOne({ where: { orderId: freshOrder.id } });

      if (freshOrder.paymentMethod === PaymentMethod.COD) {
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
      } else {
        // Udhaar: credit is only drawn against the ledger now, on actual
        // delivery — not at checkout — per PLAN-order-delivery.md §5.
        const accountRepo = manager.getRepository(UdhaarAccount);
        const transactionRepo = manager.getRepository(UdhaarTransaction);
        const account = await accountRepo
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where('a.retailerProfileId = :id', { id: freshOrder.retailerProfileId })
          .getOne();
        if (account) {
          const amount = Number(freshOrder.subtotal);
          const newBalance = Number(account.outstandingBalance) + amount;
          account.outstandingBalance = newBalance.toFixed(2);
          await accountRepo.save(account);
          await transactionRepo.save(
            transactionRepo.create({
              udhaarAccountId: account.id,
              orderId: freshOrder.id,
              type: UdhaarTransactionType.DRAW,
              amount: amount.toFixed(2),
              balanceAfter: newBalance.toFixed(2),
              note: `Order ${freshOrder.orderNumber}`,
            }),
          );
        }
        if (payment) {
          payment.status = PaymentStatus.COLLECTED;
          payment.collectedAt = new Date();
          await paymentRepo.save(payment);
        }
        freshOrder.paymentStatus = OrderPaymentStatus.PAID;
      }

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

    // No automatic retry/re-assignment in v1 (see PLAN-order-delivery.md §9)
    // — release stock and leave it to a Mandi Admin / retailer to decide next steps.
    const items = await this.orderItems.find({ where: { orderId: order.id } });
    for (const item of items) {
      if (!item.wholesalerListingId) continue;
      await this.listings.increment({ id: item.wholesalerListingId }, 'stockUnits', item.quantity);
    }

    await this.notifyRetailerFor(
      order,
      'Delivery failed',
      `${order.orderNumber} could not be delivered: ${dto.reason}`,
    );
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
            wholesalerName: order.wholesalerProfile?.shopName ?? null,
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
