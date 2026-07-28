import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";

type OverviewRow = {
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  todayStockIn: Prisma.Decimal;
  todayStockOut: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
};

type MovementRow = {
  month: string;
  stockIn: Prisma.Decimal;
  stockOut: Prisma.Decimal;
};

type CategoryRow = {
  name: string;
  productCount: number;
  inventoryValue: Prisma.Decimal;
};

type WatchlistRow = {
  sku: string;
  name: string;
  category: string;
  supplier: string | null;
  stock: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async getDashboard() {
    return this.cache.getOrSet("dashboard:overview", 15_000, () => this.loadDashboard());
  }

  private async loadDashboard() {
    const [overview, movement, categories, watchlist, transactions, activities] =
      await Promise.all([
        this.getOverview(),
        this.getMonthlyMovement(),
        this.getCategories(),
        this.getWatchlist(),
        this.getRecentTransactions(),
        this.getRecentActivities(),
      ]);

    const totalDistributed = categories.reduce((sum, item) => sum + item.productCount, 0);
    return {
      overview,
      monthlyStockMovement: movement,
      categoryDistribution: categories.map((item) => ({
        name: item.name,
        value: totalDistributed ? Math.round((item.productCount / totalDistributed) * 1000) / 10 : 0,
      })),
      inventoryValueByCategory: categories.map((item) => ({
        name: item.name,
        value: Number(item.inventoryValue),
      })),
      watchlist,
      recentTransactions: transactions,
      recentActivities: activities,
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Bangkok",
    };
  }

  private async getOverview() {
    const [row] = await this.prisma.$queryRaw<OverviewRow[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM products WHERE status = 'ACTIVE') AS "totalProducts",
        (SELECT COUNT(*)::int FROM categories WHERE status = 'ACTIVE') AS "totalCategories",
        (SELECT COUNT(*)::int FROM suppliers WHERE status = 'ACTIVE') AS "totalSuppliers",
        (SELECT COUNT(*)::int FROM products WHERE status = 'ACTIVE' AND quantity > 0 AND quantity <= minimum_stock) AS "lowStockProducts",
        (SELECT COUNT(*)::int FROM products WHERE status = 'ACTIVE' AND quantity = 0) AS "outOfStockProducts",
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type = 'STOCK_IN'), 0) AS "todayStockIn",
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type = 'STOCK_OUT'), 0) AS "todayStockOut",
        (SELECT COALESCE(SUM(quantity * average_cost), 0) FROM products WHERE status = 'ACTIVE') AS "inventoryValue"
      FROM inventory_transactions t
      LEFT JOIN inventory_transaction_items i ON i.transaction_id = t.id
      WHERE t.status = 'CONFIRMED'
        AND t.transaction_date >= (date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok')
        AND t.transaction_date < ((date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') + interval '1 day') AT TIME ZONE 'Asia/Bangkok')
    `);
    return {
      totalProducts: row?.totalProducts ?? 0,
      totalCategories: row?.totalCategories ?? 0,
      totalSuppliers: row?.totalSuppliers ?? 0,
      lowStockProducts: row?.lowStockProducts ?? 0,
      outOfStockProducts: row?.outOfStockProducts ?? 0,
      todayStockIn: Number(row?.todayStockIn ?? 0),
      todayStockOut: Number(row?.todayStockOut ?? 0),
      inventoryValue: Number(row?.inventoryValue ?? 0),
    };
  }

  private async getMonthlyMovement() {
    const rows = await this.prisma.$queryRaw<MovementRow[]>(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') - interval '5 months',
          date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok'),
          interval '1 month'
        ) AS month
      )
      SELECT
        to_char(months.month, 'Mon') AS month,
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type = 'STOCK_IN'), 0) AS "stockIn",
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type = 'STOCK_OUT'), 0) AS "stockOut"
      FROM months
      LEFT JOIN inventory_transactions t
        ON date_trunc('month', t.transaction_date AT TIME ZONE 'Asia/Bangkok') = months.month
        AND t.status = 'CONFIRMED'
      LEFT JOIN inventory_transaction_items i ON i.transaction_id = t.id
      GROUP BY months.month
      ORDER BY months.month
    `);
    return rows.map((row) => ({
      month: row.month,
      stockIn: Number(row.stockIn),
      stockOut: Number(row.stockOut),
    }));
  }

  private async getCategories() {
    return this.prisma.$queryRaw<CategoryRow[]>(Prisma.sql`
      SELECT
        c.name,
        COUNT(p.id)::int AS "productCount",
        COALESCE(SUM(p.quantity * p.average_cost), 0) AS "inventoryValue"
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.status = 'ACTIVE'
      WHERE c.status = 'ACTIVE'
      GROUP BY c.id, c.name
      ORDER BY COUNT(p.id) DESC, c.name
    `);
  }

  private async getWatchlist() {
    const rows = await this.prisma.$queryRaw<WatchlistRow[]>(Prisma.sql`
      SELECT
        p.sku,
        p.name,
        c.name AS category,
        primary_supplier.name AS supplier,
        p.quantity AS stock,
        p.minimum_stock AS "minimumStock"
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT s.name
        FROM product_suppliers ps
        JOIN suppliers s ON s.id = ps.supplier_id
        WHERE ps.product_id = p.id
        ORDER BY ps.is_primary DESC, ps.created_at
        LIMIT 1
      ) primary_supplier ON true
      WHERE p.status = 'ACTIVE' AND p.quantity <= p.minimum_stock
      ORDER BY p.quantity ASC, p.name
      LIMIT 8
    `);
    return rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category,
      supplier: row.supplier ?? "-",
      stock: Number(row.stock),
      minimumStock: Number(row.minimumStock),
      status: Number(row.stock) === 0 ? "Out of Stock" : "Low Stock",
    }));
  }

  private async getRecentTransactions() {
    const rows = await this.prisma.inventoryTransaction.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { transactionDate: "desc" },
      take: 5,
      include: {
        createdBy: { select: { fullName: true } },
        items: {
          include: { product: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return rows.map((row) => {
      const incoming = row.type === "STOCK_IN" || row.type === "RETURN_IN";
      const quantity = row.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const firstProduct = row.items[0]?.product.name ?? "No products";
      return {
        id: row.id,
        documentNumber: row.documentNumber,
        product: row.items.length > 1 ? `${firstProduct} +${row.items.length - 1}` : firstProduct,
        type: incoming ? "Stock In" : "Stock Out",
        quantity: `${incoming ? "+" : "-"}${quantity}`,
        user: row.createdBy.fullName,
        occurredAt: row.transactionDate.toISOString(),
      };
    });
  }

  private async getRecentActivities() {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { fullName: true } } },
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      action: row.action,
      entityType: row.entityType,
      user: row.user?.fullName ?? "System",
      occurredAt: row.createdAt.toISOString(),
    }));
  }
}
