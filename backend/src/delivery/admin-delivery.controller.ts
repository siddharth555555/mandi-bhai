import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { AssignDeliveryDto } from './dto/delivery.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('mandi_admin')
@Controller('admin/deliveries')
export class AdminDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  listUnassigned(@Req() req: { user: JwtPayload }) {
    return this.delivery.listUnassigned(req.user.sub);
  }

  @Get('partners')
  listPartners(@Req() req: { user: JwtPayload }) {
    return this.delivery.listPartners(req.user.sub);
  }

  @Post(':id/assign')
  assign(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.delivery.assign(req.user.sub, id, dto);
  }
}
