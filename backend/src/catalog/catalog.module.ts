import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { Product } from './product.entity';
import { ProductAlias } from './product-alias.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { AdminCatalogController } from './admin-catalog.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product, ProductAlias, WholesalerListing]),
  ],
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
