import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateAliasDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto/catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

/**
 * Master catalogue management — super admin only.
 *
 * Products are platform-wide, so this was previously `mandi_admin`: any one
 * mandi's admin could edit the shared catalogue and hit every other mandi.
 * PLAN-products-kyc.md §1 flagged that blast radius without resolving it;
 * under the managed-reseller model the catalogue is explicitly super-admin
 * owned, which closes it.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, dto);
  }

  @Get('products/:id/aliases')
  listAliases(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.listAliases(id);
  }

  @Post('products/:id/aliases')
  addAlias(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAliasDto) {
    return this.catalog.addAlias(id, dto);
  }

  @Delete('products/:id/aliases/:aliasId')
  removeAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.catalog.removeAlias(id, aliasId);
  }
}
