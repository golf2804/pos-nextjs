import { api } from "@/lib/api";

export type StockInInput = { productId: string; supplierId: string; quantity: number; costPrice: number; date: string; referenceNumber?: string; notes?: string };
export type StockOutInput = { productId: string; quantity: number; department: string; receiver: string; date: string; referenceNumber?: string; notes?: string };

const idempotencyHeaders = (requestKey: string) => ({ headers: { "Idempotency-Key": requestKey } });

export async function recordStockIn(input: StockInInput, requestKey: string) {
  const { data } = await api.post("/stock-in", input, idempotencyHeaders(requestKey));
  return data;
}

export async function recordStockOut(input: StockOutInput, requestKey: string) {
  const { data } = await api.post("/stock-out", input, idempotencyHeaders(requestKey));
  return data;
}
