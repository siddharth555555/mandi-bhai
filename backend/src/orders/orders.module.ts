import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Payment } from '../wallet/payment.entity';
import { StubGatewayDriver } from '../wallet/payment-gateway.driver';
import { OrdersService } from './orders.service';
import { RetailerOrdersController } from './retailer-orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Cart,
      CartItem,
      RetailerProfile,
      User,
      Payment,
    ]),
    PricingModule,
    CartModule,
    NotificationsModule,
  ],
  controllers: [RetailerOrdersController],
  providers: [OrdersService, StubGatewayDriver],
  exports: [OrdersService],
})
export class OrdersModule {}
