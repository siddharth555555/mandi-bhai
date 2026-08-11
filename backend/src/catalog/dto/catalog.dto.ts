import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PackUnit } from '../pack-unit';
import { AliasLocale } from '../product-alias.entity';
import { ProductStatus } from '../product.entity';

export class CreateProductDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  packValue: number;

  @IsEnum(PackUnit, {
    message: `packUnit must be one of: ${Object.values(PackUnit).join(', ')}`,
  })
  packUnit: PackUnit;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  packValue?: number;

  @IsOptional()
  @IsEnum(PackUnit)
  packUnit?: PackUnit;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class CreateAliasDto {
  @IsString()
  @MaxLength(160)
  alias: string;

  @IsOptional()
  @IsEnum(AliasLocale)
  locale?: AliasLocale;
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
