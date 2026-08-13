import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { FailDeliveryDto, MarkDeliveredDto } from './dto/delivery.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
@Controller('rider/deliveries')
export class RiderDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  listMine(@Req() req: { user: JwtPayload }) {
    return this.delivery.listMine(req.user.sub);
  }

  @Post(':id/picked-up')
  pickedUp(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.delivery.pickedUp(req.user.sub, id);
  }

  @Post(':id/delivered')
  delivered(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkDeliveredDto,
  ) {
    return this.delivery.delivered(req.user.sub, id, dto);
  }

  @Post(':id/failed')
  failed(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailDeliveryDto,
  ) {
    return this.delivery.failed(req.user.sub, id, dto);
  }
}
