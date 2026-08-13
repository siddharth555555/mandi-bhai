import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { User } from '../entities/user.entity';
import { WholesalerListing, ListingStatus } from '../listings/wholesaler-listing.entity';
import { Payment, PaymentStatus } from '../wallet/payment.entity';
import { UdhaarAccount } from '../wallet/udhaar-account.entity';
import { Delivery, DeliveryStatus } from '../delivery/delivery.entity';
import { formatPack } from '../catalog/pack-unit';
import { NotificationService } from '../notifications/notification.service';
import { RejectOrderDto, CheckoutDto } from './dto/order.dto';

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
    @InjectRepository(WholesalerProfile)
    private readonly wholesalers: Repository<WholesalerProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WholesalerListing)
    private readonly listings: Repository<WholesalerListing>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(UdhaarAccount)
    private readonly udhaarAccounts: Repository<UdhaarAccount>,
    @InjectRepository(Delivery) private readonly deliveries: Repository<Delivery>,
    private readonly notifications: NotificationService,
  ) {}

  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No retailer profile on this account');
    return profile;
  }

  private async requireWholesaler(userId: string): Promise<WholesalerProfile> {
    const profile = await this.wholesalers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No wholesaler profile on this account');
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
      relations: { wholesalerListing: { product: true, wholesaler: true } },
    });
    if (cartItems.length === 0) throw new BadRequestException('Your cart is empty');

    // Fail fast, naming the offending item, before opening a transaction.
    for (const item of cartItems) {
      const listing = item.wholesalerListing;
      if (!listing || listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException(
          `"${listing?.product?.name ?? 'An item'}" in your cart is no longer available`,
        );
      }
      if (item.quantity < listing.moq) {
        throw new BadRequestException(
          `${listing.product.name}: minimum order quantity is ${listing.moq}`,
        );
      }
    }

    const grandTotal = cartItems.reduce(
      (sum, i) => sum + Number(i.wholesalerListing.pricePerUnit) * i.quantity,
      0,
    );

    const createdOrders = await this.dataSource.transaction(async (manager) => {
      // Udhaar credit check — row-locked so two concurrent checkouts can't
      // both squeeze under the same limit.
      if (dto.paymentMethod === PaymentMethod.UDHAAR) {
        const accountRepo = manager.getRepository(UdhaarAccount);
        let account = await accountRepo.findOne({
          where: { retailerProfileId: retailer.id },
        });
        if (!account) {
          account = await accountRepo.save(
            accountRepo.create({
              retailerProfileId: retailer.id,
              creditLimit: '0',
              outstandingBalance: '0',
            }),
          );
        }
        const locked = await accountRepo
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where('a.id = :id', { id: account.id })
          .getOne();
        const limit = Number(locked!.creditLimit);
        const outstanding = Number(locked!.outstandingBalance);
        if (outstanding + grandTotal > limit) {
          throw new BadRequestException(
            `Udhaar credit limit exceeded — available ₹${Math.max(0, limit - outstanding).toFixed(2)}, this order totals ₹${grandTotal.toFixed(2)}`,
          );
        }
      }

      // Lock + decrement stock for every listing, in a stable order so two
      // concurrent checkouts touching overlapping listings can't deadlock.
      const listingRepo = manager.getRepository(WholesalerListing);
      const sortedItems = [...cartItems].sort((a, b) =>
        a.wholesalerListingId.localeCompare(b.wholesalerListingId),
      );
      for (const item of sortedItems) {
        const locked = await listingRepo
          .createQueryBuilder('l')
          .setLock('pessimistic_write')
          .where('l.id = :id', { id: item.wholesalerListingId })
          .getOne();
        if (!locked || locked.status !== ListingStatus.ACTIVE) {
          throw new BadRequestException(
            `"${item.wholesalerListing.product.name}" just became unavailable — please review your cart`,
          );
        }
        if (locked.stockUnits < item.quantity) {
          throw new BadRequestException(
            `Only ${locked.stockUnits} left of "${item.wholesalerListing.product.name}" — please adjust the quantity`,
          );
        }
        locked.stockUnits -= item.quantity;
        await listingRepo.save(locked);
      }

      // Fan out into one Order per wholesaler.
      const groups = new Map<string, typeof cartItems>();
      for (const item of cartItems) {
        const key = item.wholesalerListing.wholesalerProfileId;
        const arr = groups.get(key) ?? [];
        arr.push(item);
        groups.set(key, arr);
      }

      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);
      const paymentRepo = manager.getRepository(Payment);
      const result: Order[] = [];

      for (const [wholesalerProfileId, items] of groups) {
        const subtotal = items.reduce(
          (sum, i) => sum + Number(i.wholesalerListing.pricePerUnit) * i.quantity,
          0,
        );

        const order = await orderRepo.save(
          orderRepo.create({
            orderNumber: generateOrderNumber(),
            retailerProfileId: retailer.id,
            wholesalerProfileId,
            mandiId: items[0].wholesalerListing.mandiId,
            status: OrderStatus.PLACED,
            paymentMethod: dto.paymentMethod,
            paymentStatus: OrderPaymentStatus.PENDING,
            subtotal: subtotal.toFixed(2),
            itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
            deliveryAddress: retailer.address!,
          }),
        );

        for (const item of items) {
          const listing = item.wholesalerListing;
          await orderItemRepo.save(
            orderItemRepo.create({
              orderId: order.id,
              wholesalerListingId: listing.id,
              productId: listing.product.id,
              productNameSnapshot: listing.product.name,
              packSizeSnapshot: formatPack(
                Number(listing.product.packValue),
                listing.product.packUnit,
              ),
              quantity: item.quantity,
              pricePerUnit: listing.pricePerUnit,
              lineTotal: (Number(listing.pricePerUnit) * item.quantity).toFixed(2),
            }),
          );
        }

        await paymentRepo.save(
          paymentRepo.create({
            orderId: order.id,
            method: dto.paymentMethod,
            amount: subtotal.toFixed(2),
            status: PaymentStatus.PENDING,
          }),
        );

        result.push(order);
      }

      // Cart is spent — clear it.
      await manager.getRepository(CartItem).delete({ cartId: cart.id });

      return result;
    });

    for (const order of createdOrders) {
      const wholesaler = await this.wholesalers.findOne({
        where: { id: order.wholesalerProfileId },
      });
      order.retailerProfile = retailer;
      if (wholesaler) {
        order.wholesalerProfile = wholesaler;
        await this.notifyUser(
          wholesaler.userId,
          'New order received',
          `Order ${order.orderNumber} for ₹${order.subtotal} — confirm it from your Orders screen.`,
          { orderId: order.id },
        );
      }
    }
    await this.notifyUser(
      userId,
      'Order placed',
      `${createdOrders.length} order(s) placed for ₹${grandTotal.toFixed(2)} total.`,
      { orderIds: createdOrders.map((o) => o.id) },
    );

    return createdOrders.map((o) => this.toOrderSummary(o));
  }

  /* -------------------------------- retailer ------------------------------- */

  async listMyOrders(userId: string, status?: OrderStatus) {
    const retailer = await this.requireRetailer(userId);
    const rows = await this.orders.find({
      where: status
        ? { retailerProfileId: retailer.id, status }
        : { retailerProfileId: retailer.id },
      relations: { wholesalerProfile: true },
      order: { placedAt: 'DESC' },
    });
    return rows.map((o) => this.toOrderSummary(o));
  }

  async getOrderForRetailer(userId: string, orderId: string) {
    const retailer = await this.requireRetailer(userId);
    const order = await this.orders.findOne({
      where: { id: orderId, retailerProfileId: retailer.id },
      relations: { wholesalerProfile: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderDetail(order);
  }

  async cancelOrder(userId: string, orderId: string) {
    const retailer = await this.requireRetailer(userId);
    const order = await this.orders.findOne({
      where: { id: orderId, retailerProfileId: retailer.id },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (![OrderStatus.PLACED, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestException(
        `Order can no longer be cancelled (status: ${order.status})`,
      );
    }

    await this.releaseStock(order.id);
    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    await this.orders.save(order);

    const wholesaler = await this.wholesalers.findOne({
      where: { id: order.wholesalerProfileId },
    });
    if (wholesaler) {
      await this.notifyUser(
        wholesaler.userId,
        'Order cancelled',
        `Order ${order.orderNumber} was cancelled by the retailer.`,
        { orderId: order.id },
      );
    }

    return this.toOrderDetail(order);
  }

  /* ------------------------------- wholesaler ------------------------------ */

  async listIncoming(userId: string, status?: OrderStatus) {
    const wholesaler = await this.requireWholesaler(userId);
    const rows = await this.orders.find({
      where: status
        ? { wholesalerProfileId: wholesaler.id, status }
        : { wholesalerProfileId: wholesaler.id },
      relations: { retailerProfile: true },
      order: { placedAt: 'DESC' },
    });
    return rows.map((o) => this.toOrderSummary(o));
  }

  async getOrderForWholesaler(userId: string, orderId: string) {
    const wholesaler = await this.requireWholesaler(userId);
    const order = await this.orders.findOne({
      where: { id: orderId, wholesalerProfileId: wholesaler.id },
      relations: { retailerProfile: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderDetail(order);
  }

  async confirm(userId: string, orderId: string) {
    const wholesaler = await this.requireWholesaler(userId);
    const order = await this.requireOwnedByWholesaler(wholesaler.id, orderId);
    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(`Order can't be confirmed (status: ${order.status})`);
    }
    order.status = OrderStatus.CONFIRMED;
    order.confirmedAt = new Date();
    await this.orders.save(order);

    await this.notifyRetailerFor(order, 'Order confirmed', `${order.orderNumber} was confirmed and is being packed.`);
    return this.toOrderDetail(order);
  }

  async reject(userId: string, orderId: string, dto: RejectOrderDto) {
    const wholesaler = await this.requireWholesaler(userId);
    const order = await this.requireOwnedByWholesaler(wholesaler.id, orderId);
    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(`Order can't be rejected (status: ${order.status})`);
    }

    await this.releaseStock(order.id);
    order.status = OrderStatus.REJECTED;
    order.rejectReason = dto.reason;
    await this.orders.save(order);

    await this.notifyRetailerFor(
      order,
      'Order rejected',
      `${order.orderNumber} was rejected: ${dto.reason}`,
    );
    return this.toOrderDetail(order);
  }

  async pack(userId: string, orderId: string) {
    const wholesaler = await this.requireWholesaler(userId);
    const order = await this.requireOwnedByWholesaler(wholesaler.id, orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(`Order can't be packed (status: ${order.status})`);
    }

    order.status = OrderStatus.PACKED;
    order.packedAt = new Date();
    await this.orders.save(order);

    const existingDelivery = await this.deliveries.findOne({ where: { orderId: order.id } });
    if (!existingDelivery) {
      await this.deliveries.save(
        this.deliveries.create({
          orderId: order.id,
          mandiId: order.mandiId,
          status: DeliveryStatus.UNASSIGNED,
        }),
      );
    }

    await this.notifyRetailerFor(
      order,
      'Order packed',
      `${order.orderNumber} is packed and waiting for a rider to be assigned.`,
    );
    return this.toOrderDetail(order);
  }

  /* --------------------------------- shared -------------------------------- */

  /** Called from wholesaler reject/retailer cancel — restores every line's stock. */
  private async releaseStock(orderId: string) {
    const items = await this.orderItems.find({ where: { orderId } });
    for (const item of items) {
      if (!item.wholesalerListingId) continue;
      await this.listings.increment(
        { id: item.wholesalerListingId },
        'stockUnits',
        item.quantity,
      );
    }
  }

  private async requireOwnedByWholesaler(wholesalerProfileId: string, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, wholesalerProfileId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async notifyRetailerFor(order: Order, title: string, body: string) {
    const retailer = await this.retailers.findOne({ where: { id: order.retailerProfileId } });
    if (retailer) {
      await this.notifyUser(retailer.userId, title, body, { orderId: order.id });
    }
  }

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
      wholesalerName: o.wholesalerProfile?.shopName ?? null,
      retailerName: o.retailerProfile?.shopName ?? null,
      placedAt: o.placedAt,
      confirmedAt: o.confirmedAt ?? null,
      packedAt: o.packedAt ?? null,
      deliveredAt: o.deliveredAt ?? null,
      cancelledAt: o.cancelledAt ?? null,
    };
  }

  private async toOrderDetail(o: Order) {
    const items = await this.orderItems.find({ where: { orderId: o.id } });
    return {
      ...this.toOrderSummary(o),
      cancelReason: o.cancelReason ?? null,
      rejectReason: o.rejectReason ?? null,
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
