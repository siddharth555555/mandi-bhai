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
import { RejectOrderDto } from './dto/order.dto';
import { OrderStatus } from './order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('wholesaler')
@Controller('wholesaler/orders')
export class WholesalerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  listIncoming(
    @Req() req: { user: JwtPayload },
    @Query('status') status?: OrderStatus,
  ) {
    return this.orders.listIncoming(req.user.sub, status);
  }

  @Get(':id')
  getOne(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getOrderForWholesaler(req.user.sub, id);
  }

  @Post(':id/confirm')
  confirm(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.confirm(req.user.sub, id);
  }

  @Post(':id/reject')
  reject(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    return this.orders.reject(req.user.sub, id, dto);
  }

  @Post(':id/pack')
  pack(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.pack(req.user.sub, id);
  }
}
