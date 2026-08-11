import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateRetailerProfileDto,
  CreateWholesalerProfileDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './jwt.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    // NOTE: response includes `devOtp` because SMS sending is stubbed —
    // see TODO.md. Remove that field once a real provider is wired up.
    return this.authService.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndIssueToken(dto.phone, dto.otp);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: JwtPayload }) {
    return this.authService.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profiles/retailer')
  createRetailerProfile(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateRetailerProfileDto,
  ) {
    return this.authService.createRetailerProfile(req.user.sub, dto.shopName);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profiles/wholesaler')
  createWholesalerProfile(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateWholesalerProfileDto,
  ) {
    return this.authService.createWholesalerProfile(
      req.user.sub,
      dto.shopName,
      dto.mandiId,
    );
  }
}
