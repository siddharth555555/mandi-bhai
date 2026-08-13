import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'phone must be exactly 10 digits' })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'phone must be exactly 10 digits' })
  phone: string;

  @IsString()
  @Length(4, 4)
  otp: string;
}

export class CreateRetailerProfileDto {
  @IsString()
  shopName: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateWholesalerProfileDto {
  @IsString()
  shopName: string;

  @IsString()
  mandiId: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateAddressDto {
  @IsString()
  @Length(1, 300)
  address: string;
}

export class SwitchProfileDto {
  @IsIn(['retailer', 'wholesaler', 'mandi_admin', 'delivery_partner'])
  profile: 'retailer' | 'wholesaler' | 'mandi_admin' | 'delivery_partner';
}
