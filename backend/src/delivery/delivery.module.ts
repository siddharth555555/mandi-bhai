import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './delivery.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { User } from '../entities/user.entity';
import { Order } from '../orders/order.entity';
import { Payment } from '../wallet/payment.entity';
import { DeliveryService } from './delivery.service';
import { AdminDeliveryController } from './admin-delivery.controller';
import { RiderDeliveryController } from './rider-delivery.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, DeliveryPartnerProfile, MandiAdminProfile, RetailerProfile, User, Order, Payment]),
    NotificationsModule,
  ],
  controllers: [AdminDeliveryController, RiderDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
