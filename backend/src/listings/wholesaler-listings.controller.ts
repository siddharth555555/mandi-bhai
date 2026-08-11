import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto, UpdateListingDto } from './dto/listing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

/**
 * A wholesaler's own inventory. Listing a product that already exists in the
 * master catalogue needs no moderation — it goes live immediately. Only
 * requests for brand-new products go through review (Phase 3).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('wholesaler')
@Controller('wholesaler/listings')
export class WholesalerListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  listMine(@Req() req: { user: JwtPayload }) {
    return this.listings.listMine(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: JwtPayload }, @Body() dto: CreateListingDto) {
    return this.listings.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.remove(req.user.sub, id);
  }
}
