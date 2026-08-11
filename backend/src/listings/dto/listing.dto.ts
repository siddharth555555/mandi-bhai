import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';
import { ListingStatus } from '../wholesaler-listing.entity';

export class CreateListingDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerUnit: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  mrp?: number;

  @IsInt()
  @Min(0)
  stockUnits: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  moq?: number;
}

export class UpdateListingDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerUnit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  mrp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  moq?: number;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
