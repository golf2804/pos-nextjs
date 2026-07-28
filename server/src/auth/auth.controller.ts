import { Body, Controller, Get, Headers, Ip, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import type { AuthUser } from "./auth-user.interface.js";
import { Public } from "./decorators/public.decorator.js";
import { LoginDto, PasswordResetRequestDto } from "./login.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.authService.signInWithUsername(body.username, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("password-reset-request")
  requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(body.username);
  }

  @Get("me")
  me(@Req() request: { user: AuthUser }, @Ip() ip: string, @Headers("user-agent") agent?: string) {
    return this.authService.recordLogin(request.user, ip, agent);
  }
}
