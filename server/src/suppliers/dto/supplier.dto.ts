import { IsEmail, IsIn, IsOptional, IsString, Length } from "class-validator";

export class ListSuppliersDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateSupplierDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}
