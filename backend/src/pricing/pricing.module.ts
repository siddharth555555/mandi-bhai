import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { ProductMarkup } from './product-markup.entity';
import { PricingService } from './pricing.service';
import { SuperAdminPricingController } from './super-admin-pricing.controller';

/**
 * Exported to catalog, cart and orders — all three must price through the
 * same service so the price shown is always the price charged.
 */
@Module({
  imports: [TypeOrmModule.forFeature([WholesalerListing, ProductMarkup])],
  controllers: [SuperAdminPricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
