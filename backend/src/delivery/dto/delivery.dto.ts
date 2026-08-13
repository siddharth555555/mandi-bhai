import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class AssignDeliveryDto {
  @IsUUID()
  deliveryPartnerId: string;
}

export class MarkDeliveredDto {
  /** COD only — did the rider actually collect cash? Defaults to true. */
  @IsOptional()
  @IsBoolean()
  paymentCollected?: boolean;
}

export class FailDeliveryDto {
  @IsString()
  @Length(1, 300)
  reason: string;
}
