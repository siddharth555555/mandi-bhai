import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('retailer')
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  me(@Req() req: { user: JwtPayload }) {
    return this.wallet.me(req.user.sub);
  }
}
