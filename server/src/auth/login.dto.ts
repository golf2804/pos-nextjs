import { IsString, Length, Matches } from "class-validator";

export class LoginDto {
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class PasswordResetRequestDto {
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;
}
