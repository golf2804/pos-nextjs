import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ListNotificationsDto } from "./dto/notification.dto.js";

type NotificationClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListNotificationsDto, user: AuthUser) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.type ? { type: query.type } : {}),
      ...statusWhere(query.status),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ resolvedAt: "asc" }, { updatedAt: "desc" }],
        skip,
        take: query.limit,
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null, resolvedAt: null },
      }),
    ]);
    return {
      unreadCount,
      items: items.map(toResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
      },
    };
  }

  async markRead(id: string, user: AuthUser) {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
      include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
    });
    if (!item) throw new NotFoundException("Notification not found.");
    const updated = await this.prisma.notification.update({
      where: { id: item.id },
      data: { readAt: new Date() },
      include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
    });
    return toResponse(updated);
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, resolvedAt: null },
      data: { readAt: new Date() },
    });
    return this.list({ status: "active", page: 1, limit: 10 }, user);
  }

  async syncProductAlerts(productId: string, client: NotificationClient = this.prisma) {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true, unit: true, quantity: true, minimumStock: true, status: true },
    });
    if (!product) return;

    const isAlert = product.status === "ACTIVE" && product.quantity.lte(product.minimumStock);
    if (!isAlert) {
      await client.notification.updateMany({
        where: { productId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      return;
    }

    const out = product.quantity.isZero();
    const type = out ? "OUT_OF_STOCK" : "LOW_STOCK";
    const title = out ? "Product is out of stock" : "Product is low stock";
    const message = `${product.sku} - ${product.name} has ${Number(product.quantity)} ${product.unit} remaining. Minimum stock is ${Number(product.minimumStock)}.`;
    await client.$executeRaw(Prisma.sql`
      INSERT INTO notifications (
        id, type, title, message, source_key, user_id, product_id,
        read_at, resolved_at, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), ${type}, ${title}, ${message},
        'STOCK_ALERT:' || ${product.id}::text || ':' || profile.id::text,
        profile.id, ${product.id}::uuid, NULL, NULL, NOW(), NOW()
      FROM user_profiles AS profile
      WHERE profile.status = 'ACTIVE'
      ON CONFLICT (source_key) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        read_at = CASE
          WHEN notifications.resolved_at IS NOT NULL OR notifications.type <> EXCLUDED.type THEN NULL
          ELSE notifications.read_at
        END,
        resolved_at = NULL,
        updated_at = NOW()
    `);
  }

  async syncUserAlerts(userId: string) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE notifications AS notification
      SET resolved_at = NOW(), updated_at = NOW()
      WHERE notification.user_id = ${userId}::uuid
        AND notification.resolved_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM products AS product
          WHERE product.id = notification.product_id
            AND product.status = 'ACTIVE'
            AND product.quantity <= product.minimum_stock
        )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO notifications (
        id, type, title, message, source_key, user_id, product_id,
        read_at, resolved_at, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        CASE WHEN product.quantity = 0 THEN 'OUT_OF_STOCK' ELSE 'LOW_STOCK' END,
        CASE WHEN product.quantity = 0 THEN 'Product is out of stock' ELSE 'Product is low stock' END,
        product.sku || ' - ' || product.name || ' has ' || product.quantity::text || ' ' || product.unit
          || ' remaining. Minimum stock is ' || product.minimum_stock::text || '.',
        'STOCK_ALERT:' || product.id::text || ':' || ${userId}::text,
        ${userId}::uuid, product.id, NULL, NULL, NOW(), NOW()
      FROM products AS product
      WHERE product.status = 'ACTIVE'
        AND product.quantity <= product.minimum_stock
      ON CONFLICT (source_key) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        read_at = CASE
          WHEN notifications.resolved_at IS NOT NULL OR notifications.type <> EXCLUDED.type THEN NULL
          ELSE notifications.read_at
        END,
        resolved_at = NULL,
        updated_at = NOW()
    `);
  }
}

function statusWhere(status: ListNotificationsDto["status"]): Prisma.NotificationWhereInput {
  if (status === "unread") return { resolvedAt: null, readAt: null };
  if (status === "read") return { resolvedAt: null, readAt: { not: null } };
  if (status === "resolved") return { resolvedAt: { not: null } };
  if (status === "all") return {};
  return { resolvedAt: null };
}

function toResponse(item: {
  id: string;
  type: string;
  title: string;
  message: string;
  sourceKey: string;
  userId: string;
  productId: string;
  readAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  product: { id: string; sku: string; name: string; unit: string };
}) {
  return {
    ...item,
    readAt: item.readAt?.toISOString() ?? null,
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
