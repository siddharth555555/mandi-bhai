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
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('retailer')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getMine(@Req() req: { user: JwtPayload }) {
    return this.cart.getMyCart(req.user.sub);
  }

  @Post('items')
  addItem(@Req() req: { user: JwtPayload }, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(req.user.sub, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(req.user.sub, id, dto);
  }

  @Delete('items/:id')
  removeItem(@Req() req: { user: JwtPayload }, @Param('id', ParseUUIDPipe) id: string) {
    return this.cart.removeItem(req.user.sub, id);
  }

  @Post('validate')
  validate(@Req() req: { user: JwtPayload }) {
    return this.cart.validate(req.user.sub);
  }
}
