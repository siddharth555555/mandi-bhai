import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderPaymentStatus, OrderStatus, PaymentMethod } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
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
