import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { User } from '../entities/user.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { Payment } from '../wallet/payment.entity';
import { UdhaarAccount } from '../wallet/udhaar-account.entity';
import { Delivery } from '../delivery/delivery.entity';
import { OrdersService } from './orders.service';
import { RetailerOrdersController } from './retailer-orders.controller';
import { WholesalerOrdersController } from './wholesaler-orders.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Cart,
      CartItem,
      RetailerProfile,
      WholesalerProfile,
      User,
      WholesalerListing,
      Payment,
      UdhaarAccount,
      Delivery,
    ]),
    NotificationsModule,
  ],
  controllers: [RetailerOrdersController, WholesalerOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
