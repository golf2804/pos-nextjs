import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateSupplierDto, ListSuppliersDto, UpdateSupplierDto } from "./dto/supplier.dto.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async list(query: ListSuppliersDto) {
    const where: Prisma.SupplierWhereInput = {
      status: { not: "ARCHIVED" },
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }, { phone: { contains: query.q, mode: "insensitive" } }] } : {}),
    };
    const items = await this.prisma.supplier.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { products: true, transactions: true } } } });
    return items.map((item) => ({ ...item, productCount: item._count.products, transactionCount: item._count.transactions, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }));
  }

  async get(id: string) {
    const item = await this.prisma.supplier.findFirst({ where: { id, status: { not: "ARCHIVED" } } });
    if (!item) throw new NotFoundException("Supplier not found.");
    return item;
  }

  async create(input: CreateSupplierDto, user: AuthUser) {
    const item = await this.prisma.supplier.create({ data: { ...input, status: input.status ?? "ACTIVE" } });
    await this.audit(user, "SUPPLIER_CREATED", item.id, { name: item.name });
    this.invalidateReadCaches();
    return item;
  }

  async update(id: string, input: UpdateSupplierDto, user: AuthUser) {
    await this.get(id);
    const item = await this.prisma.supplier.update({ where: { id }, data: input });
    await this.audit(user, "SUPPLIER_UPDATED", id, { name: item.name });
    this.invalidateReadCaches();
    return item;
  }

  async remove(id: string, user: AuthUser) {
    await this.get(id);
    const item = await this.prisma.supplier.update({ where: { id }, data: { status: "ARCHIVED" } });
    await this.audit(user, "SUPPLIER_ARCHIVED", id, { name: item.name });
    this.invalidateReadCaches();
    return item;
  }

  private async audit(user: AuthUser, action: string, entityId: string, metadata: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({ data: { userId: user.id, action, entityType: "SUPPLIER", entityId, metadata } });
  }

  private invalidateReadCaches() {
    this.cache.deleteByPrefix("options:");
    this.cache.deleteByPrefix("dashboard:");
  }
}
