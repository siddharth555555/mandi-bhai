import { IsEnum, IsString } from 'class-validator';
import { PaymentMethod } from '../order.entity';

export class CheckoutDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** Issued by `POST /cart/validate` — proves the retailer saw and accepted these exact prices (PRD §9.2). */
  @IsString()
  confirmedPriceToken: string;
}
