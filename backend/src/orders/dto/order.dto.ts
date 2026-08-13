import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaymentMethod } from '../order.entity';

export class CheckoutDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class RejectOrderDto {
  @IsString()
  @Length(1, 300)
  reason: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @Length(1, 300)
  reason?: string;
}
