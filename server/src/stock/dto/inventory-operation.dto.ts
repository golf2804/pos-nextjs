import { Transform } from "class-transformer";
import { IsDateString, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

const numberValue = () => Transform(({ value }) => Number(value));

export class StockAdjustmentDto {
  @IsUUID()
  productId!: string;

  @numberValue()
  @Min(0)
  countedQuantity!: number;

  @IsString()
  @Length(2, 160)
  reason!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class ReverseTransactionDto {
  @IsString()
  @Length(2, 300)
  reason!: string;

  @IsDateString()
  date!: string;
}

export class ReturnInDto {
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

export class ReturnOutDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  supplierId!: string;

  @numberValue()
  @Min(0.0001)
  quantity!: number;

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

export class ReconcileInventoryDto {
  @IsString()
  @Length(2, 300)
  reason!: string;

  @IsDateString()
  date!: string;
}
