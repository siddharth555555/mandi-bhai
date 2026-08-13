import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class SetCreditLimitDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit: number;
}

export class RepaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  note?: string;
}
