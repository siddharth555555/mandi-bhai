import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { Mandi } from '../mandis/mandi.entity';
import { OtpService } from './otp.service';
import { JwtPayload } from './jwt.types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RetailerProfile)
    private readonly retailerProfiles: Repository<RetailerProfile>,
    @InjectRepository(WholesalerProfile)
    private readonly wholesalerProfiles: Repository<WholesalerProfile>,
    @InjectRepository(MandiAdminProfile)
    private readonly mandiAdminProfiles: Repository<MandiAdminProfile>,
    @InjectRepository(Mandi) private readonly mandis: Repository<Mandi>,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) {}

  requestOtp(phone: string) {
    return this.otpService.requestOtp(phone);
  }

  async verifyOtpAndIssueToken(phone: string, otp: string) {
    const valid = await this.otpService.verifyOtp(phone, otp);
    if (!valid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    let user = await this.users.findOne({
      where: { phone },
      relations: { retailerProfile: true, wholesalerProfile: true, mandiAdminProfile: true },
    });

    if (!user) {
      user = await this.users.save(this.users.create({ phone }));
    }

    return {
      token: this.signToken(user),
      user: this.toUserView(user),
    };
  }

  async createRetailerProfile(userId: string, shopName: string) {
    const existing = await this.retailerProfiles.findOne({ where: { userId } });
    if (existing) throw new BadRequestException('Retailer profile already exists');

    const profile = await this.retailerProfiles.save(
      this.retailerProfiles.create({ userId, shopName }),
    );
    return this.reissueToken(userId).then((token) => ({ token, profile }));
  }

  async createWholesalerProfile(userId: string, shopName: string, mandiId: string) {
    const mandi = await this.mandis.findOne({ where: { id: mandiId } });
    if (!mandi) throw new NotFoundException('Mandi not found');

    const existing = await this.wholesalerProfiles.findOne({ where: { userId } });
    if (existing) throw new BadRequestException('Wholesaler profile already exists');

    const profile = await this.wholesalerProfiles.save(
      this.wholesalerProfiles.create({ userId, shopName, mandiId }),
    );
    return this.reissueToken(userId).then((token) => ({ token, profile }));
  }

  async me(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { retailerProfile: true, wholesalerProfile: true, mandiAdminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toUserView(user);
  }

  private async reissueToken(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { retailerProfile: true, wholesalerProfile: true, mandiAdminProfile: true },
    });
    return this.signToken(user!);
  }

  private signToken(user: User): string {
    const profiles: JwtPayload['profiles'] = [];
    if (user.retailerProfile) profiles.push('retailer');
    if (user.wholesalerProfile) profiles.push('wholesaler');
    if (user.mandiAdminProfile) profiles.push('mandi_admin');

    const payload: JwtPayload = { sub: user.id, phone: user.phone, profiles };
    return this.jwtService.sign(payload);
  }

  private toUserView(user: User) {
    return {
      id: user.id,
      phone: user.phone,
      profiles: {
        retailer: user.retailerProfile ?? null,
        wholesaler: user.wholesalerProfile ?? null,
        mandiAdmin: user.mandiAdminProfile ?? null,
      },
    };
  }
}
