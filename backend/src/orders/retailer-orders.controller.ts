import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/order.dto';
import { OrderStatus } from './order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('retailer')
@Controller()
export class RetailerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  checkout(@Req() req: { user: JwtPayload }, @Body() dto: CheckoutDto) {
    return this.orders.checkout(req.user.sub, dto);
  }

  @Get('orders')
  listMine(
    @Req() req: { user: JwtPayload },
    @Query('status') status?: OrderStatus,
  ) {
    return this.orders.listMyOrders(req.user.sub, status);
  }

  @Get('orders/:id')
  getOne(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getOrderForRetailer(req.user.sub, id);
  }

  @Post('orders/:id/cancel')
  cancel(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.cancelOrder(req.user.sub, id);
  }
}
