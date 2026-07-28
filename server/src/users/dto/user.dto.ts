import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateUserDto {
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Length(2, 160)
  fullName!: string;

  @IsIn(["ADMIN", "MANAGER", "STAFF"])
  roleCode!: "ADMIN" | "MANAGER" | "STAFF";

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @IsOptional()
  @IsIn(["ADMIN", "MANAGER", "STAFF"])
  roleCode?: "ADMIN" | "MANAGER" | "STAFF";

  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED"])
  status?: "ACTIVE" | "DISABLED";
}

export class ResetUserPasswordDto {
  @IsString()
  @Length(8, 128)
  password!: string;
}
