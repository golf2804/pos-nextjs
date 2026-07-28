import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { createInventoryDocumentNumber, inventoryTransactionOptions } from "../inventory/inventory.utils.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateProductDto, ListProductsDto, UpdateProductDto } from "./dto/product.dto.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const productInclude = {
  category: { select: { id: true, name: true } },
  suppliers: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { isPrimary: "desc" as const } },
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
    private readonly config: ConfigService = new ConfigService(process.env),
  ) {}

  async uploadImage(file: { buffer: Buffer; mimetype: string; originalname: string; size: number }) {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException("Use a JPEG, PNG, WebP, or GIF image.");
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException("Image must not exceed 5 MB.");

    const path = `products/${randomUUID()}.${extension}`;
    const { secret, url } = this.storageConfig();
    const response = await fetch(`${url}/storage/v1/object/product-images/${path}`, {
      method: "POST",
      headers: {
        apikey: secret,
        authorization: `Bearer ${secret}`,
        "content-type": file.mimetype,
        "x-upsert": "false",
      },
      body: new Uint8Array(file.buffer),
    });
    if (!response.ok) throw new BadRequestException("Product image upload failed.");
    return {
      path,
      url: `${url}/storage/v1/object/public/product-images/${path}`,
    };
  }

  async list(query: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      status: query.status ?? { not: "ARCHIVED" },
    };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { sku: { contains: query.q, mode: "insensitive" } },
        { barcode: { contains: query.q, mode: "insensitive" } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.supplierId) where.suppliers = { some: { supplierId: query.supplierId } };
    if (query.stockStatus === "out_of_stock") where.quantity = 0;
    if (query.stockStatus === "low_stock") where.AND = [{ quantity: { gt: 0 } }, { quantity: { lte: this.prisma.product.fields.minimumStock } }];
    if (query.stockStatus === "in_stock") where.quantity = { gt: this.prisma.product.fields.minimumStock };

    const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.ProductOrderByWithRelationInput;
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [orderBy, { id: query.sortOrder }],
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toResponse(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
        nextCursor: items.length === query.limit ? items.at(-1)?.id ?? null : null,
      },
    };
  }

  async options() {
    return this.cache.getOrSet("options:product", 5 * 60_000, async () => {
      const [categories, suppliers] = await Promise.all([
        this.prisma.category.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        this.prisma.supplier.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ]);
      return { categories, suppliers };
    });
  }

  async get(id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, status: { not: "ARCHIVED" } }, include: productInclude });
    if (!product) throw new NotFoundException("Product not found.");
    return this.toResponse(product);
  }

  async create(input: CreateProductDto, user: AuthUser) {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const initialQuantity = new Prisma.Decimal(input.quantity);
        const product = await tx.product.create({
          data: {
            sku: input.sku,
            barcode: input.barcode,
            name: input.name,
            description: input.description,
            imageUrl: this.validateImageUrl(input.imageUrl),
            categoryId: input.categoryId,
            costPrice: input.costPrice,
            averageCost: input.costPrice,
            sellingPrice: input.sellingPrice,
            quantity: 0,
            minimumStock: input.minimumStock,
            unit: input.unit,
            status: input.status ?? "ACTIVE",
            suppliers: input.supplierId ? { create: { supplierId: input.supplierId, isPrimary: true } } : undefined,
          },
          include: productInclude,
        });

        if (initialQuantity.gt(0)) {
          const transaction = await tx.inventoryTransaction.create({
            data: {
              documentNumber: createInventoryDocumentNumber("ADJ"),
              type: "ADJUSTMENT",
              referenceNumber: "INITIAL-STOCK",
              notes: "Initial stock recorded during product creation",
              createdById: user.id,
              items: {
                create: {
                  productId: product.id,
                  quantity: initialQuantity,
                  unitCost: input.costPrice,
                  quantityBefore: 0,
                  quantityAfter: initialQuantity,
                },
              },
            },
          });
          await tx.product.update({ where: { id: product.id }, data: { quantity: initialQuantity } });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: "INITIAL_STOCK_RECORDED",
              entityType: "INVENTORY_TRANSACTION",
              entityId: transaction.id,
              metadata: { productId: product.id, quantity: input.quantity, unitCost: input.costPrice },
            },
          });
        }
        await this.notifications.syncProductAlerts(product.id, tx);
        await tx.auditLog.create({
          data: { userId: user.id, action: "PRODUCT_CREATED", entityType: "PRODUCT", entityId: product.id, metadata: { sku: product.sku } },
        });
        const created = await tx.product.findUniqueOrThrow({ where: { id: product.id }, include: productInclude });
        return this.toResponse(created);
      }, inventoryTransactionOptions());
      this.invalidateReadCaches();
      return created;
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateProductDto, user: AuthUser) {
    const current = await this.get(id);
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (input.supplierId !== undefined) {
          await tx.productSupplier.deleteMany({ where: { productId: id } });
          if (input.supplierId) await tx.productSupplier.create({ data: { productId: id, supplierId: input.supplierId, isPrimary: true } });
        }
        const product = await tx.product.update({
          where: { id },
          data: {
            sku: input.sku,
            barcode: input.barcode,
            name: input.name,
            description: input.description,
            imageUrl: this.validateImageUrl(input.imageUrl),
            categoryId: input.categoryId,
            costPrice: input.costPrice,
            averageCost: input.costPrice !== undefined && current.quantity === 0
              ? input.costPrice
              : undefined,
            sellingPrice: input.sellingPrice,
            minimumStock: input.minimumStock,
            unit: input.unit,
            status: input.status,
          },
          include: productInclude,
        });
        await this.notifications.syncProductAlerts(id, tx);
        return product;
      });
      await this.audit(user, "PRODUCT_UPDATED", id, { sku: product.sku });
      this.invalidateReadCaches();
      return this.toResponse(product);
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async remove(id: string, user: AuthUser) {
    await this.get(id);
    const product = await this.prisma.$transaction(async (tx) => {
      const archived = await tx.product.update({ where: { id }, data: { status: RecordStatus.ARCHIVED }, include: productInclude });
      await this.notifications.syncProductAlerts(id, tx);
      await tx.auditLog.create({ data: { userId: user.id, action: "PRODUCT_ARCHIVED", entityType: "PRODUCT", entityId: id, metadata: { sku: archived.sku } } });
      return archived;
    });
    this.invalidateReadCaches();
    return this.toResponse(product);
  }

  private invalidateReadCaches() {
    this.cache.deleteByPrefix("dashboard:");
    this.cache.deleteByPrefix("reports:");
  }

  private validateImageUrl(imageUrl: string | undefined) {
    if (!imageUrl) return undefined;
    const { url } = this.storageConfig();
    const expectedPrefix = `${url}/storage/v1/object/public/product-images/products/`;
    if (!imageUrl.startsWith(expectedPrefix)) {
      throw new BadRequestException("Product image must be uploaded through the inventory image endpoint.");
    }
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new BadRequestException("Product image URL is invalid.");
    }
    if (parsed.search || parsed.hash) throw new BadRequestException("Product image URL cannot contain query parameters or fragments.");
    return imageUrl;
  }

  private storageConfig() {
    return {
      secret: this.config.getOrThrow<string>("SUPABASE_SECRET_KEY"),
      url: this.config.getOrThrow<string>("SUPABASE_URL").replace(/\/$/, ""),
    };
  }

  private toResponse(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>) {
    const supplier = product.suppliers[0]?.supplier ?? null;
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      category: product.category,
      supplier,
      costPrice: Number(product.costPrice),
      averageCost: Number(product.averageCost),
      sellingPrice: Number(product.sellingPrice),
      quantity: Number(product.quantity),
      minimumStock: Number(product.minimumStock),
      unit: product.unit,
      status: product.status,
      stockStatus: Number(product.quantity) === 0 ? "OUT_OF_STOCK" : Number(product.quantity) <= Number(product.minimumStock) ? "LOW_STOCK" : "IN_STOCK",
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private async audit(user: AuthUser, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({ data: { userId: user.id, action, entityType: "PRODUCT", entityId, metadata } });
  }

  private handleKnownError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("SKU or barcode already exists.");
    }
  }
}
