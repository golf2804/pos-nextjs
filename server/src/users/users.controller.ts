import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from "./dto/user.dto.js";
import { UsersService } from "./users.service.js";

@Roles(AppRole.ADMIN)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get() list() { return this.usersService.list(); }
  @Post() create(@Body() body: CreateUserDto, @Req() request: { user: AuthUser }) { return this.usersService.create(body, request.user); }
  @Patch(":id") update(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateUserDto, @Req() request: { user: AuthUser }) { return this.usersService.update(id, body, request.user); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @Post(":id/reset-password") resetPassword(@Param("id", ParseUUIDPipe) id: string, @Body() body: ResetUserPasswordDto, @Req() request: { user: AuthUser }) { return this.usersService.resetPassword(id, body.password, request.user); }
  @Delete(":id") remove(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: AuthUser }) { return this.usersService.remove(id, request.user); }
}
