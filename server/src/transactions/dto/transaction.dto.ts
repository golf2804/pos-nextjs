import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class ListTransactionsDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "RETURN_IN", "RETURN_OUT", "REVERSAL"])
  type?: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "RETURN_IN" | "RETURN_OUT" | "REVERSAL";

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsUUID()
  cursor?: string;
}
