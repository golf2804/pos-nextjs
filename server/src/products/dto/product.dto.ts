import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Matches, Max, Min } from "class-validator";

const optionalText = () => Transform(({ value }) => value === "" || value === undefined ? undefined : String(value).trim());
const numberValue = () => Transform(({ value }) => value === "" || value === undefined ? undefined : Number(value));

export class ListProductsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";

  @IsOptional()
  @IsIn(["all", "in_stock", "low_stock", "out_of_stock"])
  stockStatus?: "all" | "in_stock" | "low_stock" | "out_of_stock";

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsIn(["name", "sku", "quantity", "sellingPrice", "costPrice", "createdAt"])
  sortBy: "name" | "sku" | "quantity" | "sellingPrice" | "costPrice" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "desc";
}

export class CreateProductDto {
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sku!: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @Length(1, 64)
  barcode?: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  imageUrl?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @numberValue()
  @Min(0)
  costPrice!: number;

  @numberValue()
  @Min(0)
  sellingPrice!: number;

  @numberValue()
  @Min(0)
  quantity!: number;

  @numberValue()
  @Min(0)
  minimumStock!: number;

  @IsString()
  @Length(1, 24)
  unit!: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  sku?: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @Length(1, 64)
  barcode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @optionalText()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  imageUrl?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @numberValue()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @numberValue()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @numberValue()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsString()
  @Length(1, 24)
  unit?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
