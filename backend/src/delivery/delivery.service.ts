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
