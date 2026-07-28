import { api } from "@/lib/api";

export type Supplier = { id: string; name: string; email: string | null; phone: string | null; address: string | null; status: "ACTIVE" | "INACTIVE" | "ARCHIVED"; productCount: number; transactionCount: number; createdAt: string; updatedAt: string };
export type SupplierInput = { name: string; email?: string; phone?: string; address?: string; status?: "ACTIVE" | "INACTIVE" };

export async function getSuppliers(q?: string) { const { data } = await api.get<Supplier[]>("/suppliers", { params: { q } }); return data; }
export async function createSupplier(input: SupplierInput) { const { data } = await api.post<Supplier>("/suppliers", input); return data; }
export async function updateSupplier(id: string, input: SupplierInput) { const { data } = await api.patch<Supplier>(`/suppliers/${id}`, input); return data; }
export async function deleteSupplier(id: string) { const { data } = await api.delete<Supplier>(`/suppliers/${id}`); return data; }
