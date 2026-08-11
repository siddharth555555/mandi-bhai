import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WholesalerListing } from './wholesaler-listing.entity';
import { Product } from '../catalog/product.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { ListingsService } from './listings.service';
import { WholesalerListingsController } from './wholesaler-listings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WholesalerListing, Product, WholesalerProfile]),
  ],
  controllers: [WholesalerListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
