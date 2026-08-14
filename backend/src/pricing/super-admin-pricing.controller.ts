import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { JwtPayload } from '../auth/jwt.types';
import { PricingService } from './pricing.service';
import { SetMarkupDto } from './dto/markup.dto';

/**
 * Super admin pricing console.
 *
 * The only surface that exposes wholesaler quotes, cost and margin. The super
 * admin sets the markup and an optional MOQ override — never the price, which
 * always derives from the cheapest in-stock quote.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('super-admin/pricing')
export class SuperAdminPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('products/:id')
  breakdown(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricing.quoteBreakdownFor(id);
  }

  @Put('products/:id/markup')
  setMarkup(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMarkupDto,
  ) {
    return this.pricing.setMarkup(id, dto, req.user.sub);
  }
}
