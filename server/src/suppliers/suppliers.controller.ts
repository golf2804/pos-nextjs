import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { CreateSupplierDto, ListSuppliersDto, UpdateSupplierDto } from "./dto/supplier.dto.js";
import { SuppliersService } from "./suppliers.service.js";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Query() query: ListSuppliersDto) { return this.suppliersService.list(query); }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) { return this.suppliersService.get(id); }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post()
  create(@Body() body: CreateSupplierDto, @Req() request: { user: AuthUser }) { return this.suppliersService.create(body, request.user); }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateSupplierDto, @Req() request: { user: AuthUser }) { return this.suppliersService.update(id, body, request.user); }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: AuthUser }) { return this.suppliersService.remove(id, request.user); }
}
