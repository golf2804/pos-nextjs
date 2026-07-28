import { api } from "@/lib/api";

export type DashboardData = {
  overview: {
    totalProducts: number;
    totalCategories: number;
    totalSuppliers: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    todayStockIn: number;
    todayStockOut: number;
    inventoryValue: number;
  };
  monthlyStockMovement: Array<{ month: string; stockIn: number; stockOut: number }>;
  categoryDistribution: Array<{ name: string; value: number }>;
  inventoryValueByCategory: Array<{ name: string; value: number }>;
  watchlist: Array<{
    sku: string;
    name: string;
    category: string;
    supplier: string;
    stock: number;
    minimumStock: number;
    status: "Low Stock" | "Out of Stock";
  }>;
  recentTransactions: Array<{
    id: string;
    documentNumber: string;
    product: string;
    type: "Stock In" | "Stock Out";
    quantity: string;
    user: string;
    occurredAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    entityType: string | null;
    user: string;
    occurredAt: string;
  }>;
  generatedAt: string;
  timezone: string;
};

export async function getDashboard() {
  const response = await api.get<DashboardData>("/dashboard");
  return response.data;
}
