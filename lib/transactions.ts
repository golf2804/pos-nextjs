import { api } from "@/lib/api";

export type TransactionType = "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "RETURN_IN" | "RETURN_OUT" | "REVERSAL";
export type Transaction = {
  id: string;
  documentNumber: string;
  type: TransactionType;
  status: "CONFIRMED" | "REVERSED";
  referenceNumber: string | null;
  supplier: { id: string; name: string } | null;
  department: string | null;
  receiver: string | null;
  notes: string | null;
  createdBy: { id: string; fullName: string };
  transactionDate: string;
  quantity: number;
  value: number;
  items: { id: string; product: { id: string; sku: string; name: string; unit: string }; quantity: number; unitCost: number; quantityBefore: number; quantityAfter: number }[];
};

export type TransactionParams = { productId?: string; userId?: string; type?: TransactionType; dateFrom?: string; dateTo?: string; page?: number; limit?: number };

export async function getTransactions(params: TransactionParams) {
  const { data } = await api.get<{ items: Transaction[]; users: { id: string; fullName: string }[]; meta: { page: number; limit: number; total: number; pageCount: number } }>("/transactions", { params });
  return data;
}
