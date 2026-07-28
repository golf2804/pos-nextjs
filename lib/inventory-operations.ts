import { api } from "@/lib/api";

export type AdjustmentInput = { productId: string; countedQuantity: number; reason: string; date: string; notes?: string };
export type ReturnInInput = { productId: string; quantity: number; department: string; receiver: string; date: string; referenceNumber?: string; notes?: string };
export type ReturnOutInput = { productId: string; supplierId: string; quantity: number; date: string; referenceNumber?: string; notes?: string };
export type ReversalInput = { reason: string; date: string };
export type Reconciliation = {
  items: Array<{ productId: string; sku: string; name: string; unit: string; productQuantity: number; ledgerQuantity: number; difference: number; status: "MATCH" | "MISMATCH" }>;
  summary: { total: number; matched: number; mismatched: number };
  generatedAt: string;
};

const requestConfig = () => ({ headers: { "Idempotency-Key": crypto.randomUUID() } });

export async function recordAdjustment(input: AdjustmentInput) {
  const { data } = await api.post("/stock-adjustments", input, requestConfig());
  return data;
}

export async function recordReturnIn(input: ReturnInInput) {
  const { data } = await api.post("/returns/in", input, requestConfig());
  return data;
}

export async function recordReturnOut(input: ReturnOutInput) {
  const { data } = await api.post("/returns/out", input, requestConfig());
  return data;
}

export async function reverseTransaction(transactionId: string, input: ReversalInput) {
  const { data } = await api.post(`/transactions/${transactionId}/reverse`, input, requestConfig());
  return data;
}

export async function getReconciliation() {
  const { data } = await api.get<Reconciliation>("/inventory/reconciliation");
  return data;
}

export async function repairReconciliation(productId: string, input: ReversalInput) {
  const { data } = await api.post(`/inventory/reconciliation/${productId}/repair`, input, requestConfig());
  return data;
}
