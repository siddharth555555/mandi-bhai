import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { DeliveryPartnerProfile } from '../entities/delivery-partner-profile.entity';
import { Mandi } from '../mandis/mandi.entity';
import { OtpService } from './otp.service';
import { JwtPayload } from './jwt.types';

const PROFILE_RELATIONS = {
  retailerProfile: true,
  wholesalerProfile: true,
  mandiAdminProfile: true,
  deliveryPartnerProfile: true,
};

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
    @InjectRepository(DeliveryPartnerProfile)
    private readonly deliveryPartnerProfiles: Repository<DeliveryPartnerProfile>,
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
      relations: PROFILE_RELATIONS,
    });

    if (!user) {
      user = await this.users.save(this.users.create({ phone }));
    }

    return {
      token: this.signToken(user),
      user: this.toUserView(user),
    };
  }

  async createRetailerProfile(userId: string, shopName: string, address?: string) {
    const existing = await this.retailerProfiles.findOne({ where: { userId } });
    if (existing) throw new BadRequestException('Retailer profile already exists');

    const profile = await this.retailerProfiles.save(
      this.retailerProfiles.create({ userId, shopName, address }),
    );
    return this.reissueToken(userId).then((token) => ({ token, profile }));
  }

  async createWholesalerProfile(
    userId: string,
    shopName: string,
    mandiId: string,
    address?: string,
  ) {
    const mandi = await this.mandis.findOne({ where: { id: mandiId } });
    if (!mandi) throw new NotFoundException('Mandi not found');

    const existing = await this.wholesalerProfiles.findOne({ where: { userId } });
    if (existing) throw new BadRequestException('Wholesaler profile already exists');

    const profile = await this.wholesalerProfiles.save(
      this.wholesalerProfiles.create({ userId, shopName, mandiId, address }),
    );
    return this.reissueToken(userId).then((token) => ({ token, profile }));
  }

  /**
   * Delivery needs an address to navigate to (see PLAN-order-delivery.md
   * §1), and neither signup form captured one before this module. These
   * let either role set/update it after the fact from a Profile screen.
   */
  async updateRetailerAddress(userId: string, address: string) {
    const profile = await this.retailerProfiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Retailer profile not found');
    profile.address = address;
    return this.retailerProfiles.save(profile);
  }

  async updateWholesalerAddress(userId: string, address: string) {
    const profile = await this.wholesalerProfiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Wholesaler profile not found');
    profile.address = address;
    return this.wholesalerProfiles.save(profile);
  }

  async me(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: PROFILE_RELATIONS,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toUserView(user);
  }

  private async reissueToken(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: PROFILE_RELATIONS,
    });
    return this.signToken(user!);
  }

  private signToken(user: User): string {
    const profiles: JwtPayload['profiles'] = [];
    if (user.retailerProfile) profiles.push('retailer');
    if (user.wholesalerProfile) profiles.push('wholesaler');
    if (user.mandiAdminProfile) profiles.push('mandi_admin');
    if (user.deliveryPartnerProfile) profiles.push('delivery_partner');

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
        deliveryPartner: user.deliveryPartnerProfile ?? null,
      },
    };
  }
}
