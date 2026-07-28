import { Transform } from "class-transformer";
import { IsDateString, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

const numberValue = () => Transform(({ value }) => Number(value));

export class StockInDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  supplierId!: string;

  @numberValue()
  @Min(0.0001)
  quantity!: number;

  @numberValue()
  @Min(0)
  costPrice!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class StockOutDto {
  @IsUUID()
  productId!: string;

  @numberValue()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @Length(1, 120)
  department!: string;

  @IsString()
  @Length(1, 120)
  receiver!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
