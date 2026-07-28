import { api } from "@/lib/api";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = { name: string; description?: string; status?: "ACTIVE" | "INACTIVE" };

export async function getCategories(q?: string) {
  const { data } = await api.get<Category[]>("/categories", { params: { q } });
  return data;
}

export async function createCategory(input: CategoryInput) {
  const { data } = await api.post<Category>("/categories", input);
  return data;
}

export async function updateCategory(id: string, input: CategoryInput) {
  const { data } = await api.patch<Category>(`/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: string) {
  const { data } = await api.delete<Category>(`/categories/${id}`);
  return data;
}
