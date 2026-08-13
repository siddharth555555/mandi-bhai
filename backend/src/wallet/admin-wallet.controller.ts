import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { RepaymentDto, SetCreditLimitDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import type { JwtPayload } from '../auth/jwt.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('mandi_admin')
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Patch(':retailerProfileId/limit')
  setLimit(
    @Req() req: { user: JwtPayload },
    @Param('retailerProfileId') retailerProfileId: string,
    @Body() dto: SetCreditLimitDto,
  ) {
    return this.wallet.setCreditLimit(req.user.sub, retailerProfileId, dto);
  }

  @Post(':retailerProfileId/repayment')
  recordRepayment(
    @Req() req: { user: JwtPayload },
    @Param('retailerProfileId') retailerProfileId: string,
    @Body() dto: RepaymentDto,
  ) {
    return this.wallet.recordRepayment(req.user.sub, retailerProfileId, dto);
  }
}
