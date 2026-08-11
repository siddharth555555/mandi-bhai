import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto/catalog.dto';

/**
 * Public catalogue browsing — used by the retailer app. No auth required:
 * the master catalogue is not sensitive, and prices (which are) live on
 * wholesaler listings, not here.
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get('products')
  searchProducts(@Query() query: ProductQueryDto) {
    return this.catalog.searchProducts(query);
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(id);
  }
}
