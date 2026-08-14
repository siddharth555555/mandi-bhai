import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetMarkupDto {
  /** Percentage added to the sourcing quote, e.g. 10 for +10%. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(500)
  percent: number;

  /** Optional platform override of the wholesaler's MOQ. */
  @IsOptional()
  @IsInt()
  @Min(1)
  moqOverride?: number | null;
}
