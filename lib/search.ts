import { api } from "@/lib/api";

export type SearchResults = {
  products: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    quantity: number;
    unit: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  transactions: Array<{
    id: string;
    documentNumber: string;
    type: string;
    transactionDate: string;
    items: Array<{ product: { name: string; sku: string } }>;
  }>;
};

export async function searchInventory(q: string) {
  const { data } = await api.get<SearchResults>("/search", { params: { q } });
  return data;
}
