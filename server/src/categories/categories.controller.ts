import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { CategoriesService } from "./categories.service.js";
import { CreateCategoryDto, ListCategoriesDto, UpdateCategoryDto } from "./dto/category.dto.js";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Query() query: ListCategoriesDto) {
    return this.categoriesService.list(query);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.categoriesService.get(id);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post()
  create(@Body() body: CreateCategoryDto, @Req() request: { user: AuthUser }) {
    return this.categoriesService.create(body, request.user);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateCategoryDto, @Req() request: { user: AuthUser }) {
    return this.categoriesService.update(id, body, request.user);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: AuthUser }) {
    return this.categoriesService.remove(id, request.user);
  }
}
