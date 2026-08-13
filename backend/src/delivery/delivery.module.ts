import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './delivery.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { Payment } from '../wallet/payment.entity';
import { UdhaarAccount } from '../wallet/udhaar-account.entity';
import { UdhaarTransaction } from '../wallet/udhaar-transaction.entity';
import { DeliveryService } from './delivery.service';
import { AdminDeliveryController } from './admin-delivery.controller';
import { RiderDeliveryController } from './rider-delivery.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Delivery,
      DeliveryPartnerProfile,
      MandiAdminProfile,
      RetailerProfile,
      User,
      Order,
      OrderItem,
      WholesalerListing,
      Payment,
      UdhaarAccount,
      UdhaarTransaction,
    ]),
    NotificationsModule,
  ],
  controllers: [AdminDeliveryController, RiderDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
