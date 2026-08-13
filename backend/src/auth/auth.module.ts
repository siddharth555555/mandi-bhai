import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { OtpRequest } from './otp-request.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../entities/user.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { Mandi } from '../mandis/mandi.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RetailerProfile,
      WholesalerProfile,
      MandiAdminProfile,
      DeliveryPartnerProfile,
      Mandi,
      OtpRequest,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-only-secret-change-me'),
        signOptions: { expiresIn: '30d' }, // TODO: shorten + add refresh tokens, see TODO.md
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
})
export class AuthModule {}
