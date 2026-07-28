import { api } from "@/lib/api";

export type ProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  costPrice: number;
  averageCost: number;
  sellingPrice: number;
  quantity: number;
  minimumStock: number;
  unit: string;
  status: ProductStatus;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  createdAt: string;
  updatedAt: string;
};

export type ProductFormInput = {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minimumStock: number;
  unit: string;
  status?: "ACTIVE" | "INACTIVE";
};

export type ProductUpdateInput = Omit<ProductFormInput, "quantity">;

export type ProductListParams = {
  q?: string;
  categoryId?: string;
  supplierId?: string;
  status?: ProductStatus;
  stockStatus?: "all" | "in_stock" | "low_stock" | "out_of_stock";
  page?: number;
  limit?: number;
  sortBy?: "name" | "sku" | "quantity" | "sellingPrice" | "costPrice" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export async function getProducts(params: ProductListParams) {
  const { data } = await api.get<{ items: Product[]; meta: { page: number; limit: number; total: number; pageCount: number } }>("/products", { params });
  return data;
}

export async function getProductOptions() {
  const { data } = await api.get<{ categories: { id: string; name: string }[]; suppliers: { id: string; name: string }[] }>("/products/options");
  return data;
}

export async function createProduct(input: ProductFormInput) {
  const { data } = await api.post<Product>("/products", input);
  return data;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  const { data } = await api.patch<Product>(`/products/${id}`, input);
  return data;
}

export async function deleteProduct(id: string) {
  const { data } = await api.delete<Product>(`/products/${id}`);
  return data;
}

export async function uploadProductImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ path: string; url: string }>("/products/images", form);
  return data;
}
