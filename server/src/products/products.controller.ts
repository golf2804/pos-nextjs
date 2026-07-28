import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { CreateProductDto, ListProductsDto, UpdateProductDto } from "./dto/product.dto.js";
import { ProductsService } from "./products.service.js";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsDto) {
    return this.productsService.list(query);
  }

  @Get("options")
  @Header("Cache-Control", "private, max-age=300, stale-while-revalidate=600")
  options() {
    return this.productsService.options();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.productsService.get(id);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post("images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadImage(@UploadedFile() file?: ProductImageFile) {
    if (!file) throw new BadRequestException("Select an image to upload.");
    return this.productsService.uploadImage(file);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post()
  create(@Body() body: CreateProductDto, @Req() request: { user: AuthUser }) {
    return this.productsService.create(body, request.user);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateProductDto, @Req() request: { user: AuthUser }) {
    return this.productsService.update(id, body, request.user);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: AuthUser }) {
    return this.productsService.remove(id, request.user);
  }
}

type ProductImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};
