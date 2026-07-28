import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateCategoryDto, ListCategoriesDto, UpdateCategoryDto } from "./dto/category.dto.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async list(query: ListCategoriesDto) {
    const where: Prisma.CategoryWhereInput = {
      status: { not: "ARCHIVED" },
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
    };
    const items = await this.prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      status: item.status,
      productCount: item._count.products,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async get(id: string) {
    const item = await this.prisma.category.findFirst({ where: { id, status: { not: "ARCHIVED" } } });
    if (!item) throw new NotFoundException("Category not found.");
    return item;
  }

  async create(input: CreateCategoryDto, user: AuthUser) {
    try {
      const item = await this.prisma.category.create({ data: { ...input, status: input.status ?? "ACTIVE" } });
      await this.audit(user, "CATEGORY_CREATED", item.id, { name: item.name });
      this.cache.deleteByPrefix("options:");
      this.cache.deleteByPrefix("dashboard:");
      return item;
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryDto, user: AuthUser) {
    await this.get(id);
    try {
      const item = await this.prisma.category.update({ where: { id }, data: input });
      await this.audit(user, "CATEGORY_UPDATED", id, { name: item.name });
      this.cache.deleteByPrefix("options:");
      this.cache.deleteByPrefix("dashboard:");
      return item;
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async remove(id: string, user: AuthUser) {
    await this.get(id);
    const item = await this.prisma.category.update({ where: { id }, data: { status: "ARCHIVED" } });
    await this.audit(user, "CATEGORY_ARCHIVED", id, { name: item.name });
    this.cache.deleteByPrefix("options:");
    this.cache.deleteByPrefix("dashboard:");
    return item;
  }

  private async audit(user: AuthUser, action: string, entityId: string, metadata: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({ data: { userId: user.id, action, entityType: "CATEGORY", entityId, metadata } });
  }

  private handleKnownError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("Category name already exists.");
    }
  }
}
