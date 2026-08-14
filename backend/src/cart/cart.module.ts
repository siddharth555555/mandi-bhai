import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { Product } from '../catalog/product.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartPriceTokenService } from './cart-price-token.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, RetailerProfile, Product]),
    PricingModule,
  ],
  controllers: [CartController],
  providers: [CartService, CartPriceTokenService],
  exports: [CartService, CartPriceTokenService],
})
export class CartModule {}
