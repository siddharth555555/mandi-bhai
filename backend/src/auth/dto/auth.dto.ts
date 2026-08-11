import { IsIn, IsString, Length, Matches } from 'class-validator';

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
}

export class CreateWholesalerProfileDto {
  @IsString()
  shopName: string;

  @IsString()
  mandiId: string;
}

export class SwitchProfileDto {
  @IsIn(['retailer', 'wholesaler', 'mandi_admin'])
  profile: 'retailer' | 'wholesaler' | 'mandi_admin';
}
