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
 * Mandi Admin catalogue management.
 *
 * Note: master products are platform-wide, not mandi-scoped, so any mandi
 * admin edits the shared catalogue. That's intentional for a *master*
 * catalogue but does mean cross-mandi blast radius — see PLAN-products-kyc.md
 * §1 if that needs tightening later.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('mandi_admin')
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
