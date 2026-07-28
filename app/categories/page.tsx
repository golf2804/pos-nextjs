"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LoaderCircle, Pencil, Save, Search, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createCategory,
  deleteCategory,
  getCategories,
  type Category,
  type CategoryInput,
  updateCategory,
} from "@/lib/categories";
import { canManageInventory, useCurrentUser } from "@/lib/auth/current-user";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/errors";

const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name must contain at least 2 characters.").max(120, "Category name must not exceed 120 characters."),
  description: z.string().trim().max(500, "Description must not exceed 500 characters."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
type CategoryFormValues = z.infer<typeof categorySchema>;
const emptyForm: CategoryFormValues = { name: "", description: "", status: "ACTIVE" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading categories...</div>}>
      <CategoriesContent />
    </Suspense>
  );
}

function CategoriesContent() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const canManage = canManageInventory(me.data?.role);
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyForm,
    mode: "onBlur",
  });

  const categories = useQuery({
    queryKey: ["categories", q],
    queryFn: () => getCategories(q),
  });
  const saveMutation = useMutation({
    mutationFn: (input: CategoryInput) =>
      editing
        ? updateCategory(editing.id, input)
        : createCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["product-options"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      form.reset(emptyForm);
      setError("");
    },
    onError: (err) => setError(getApiErrorMessage(err, "Unable to save category.")),
  });
  const removeMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["product-options"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function edit(category: Category) {
    setEditing(category);
    form.reset({
      name: category.name,
      description: category.description ?? "",
      status: category.status === "ARCHIVED" ? "INACTIVE" : category.status,
    });
    setError("");
  }

  const submit = form.handleSubmit((values) => {
    setError("");
    saveMutation.mutate({
      ...values,
      name: values.name.trim(),
      description: values.description.trim() || undefined,
    });
  });

  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <div className={`mx-auto grid max-w-7xl gap-5 ${canManage ? "lg:grid-cols-[360px_minmax(0,1fr)]" : ""}`}>
        {canManage && (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{editing ? "Update Category" : "Create Category"}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Group products for filtering and reports</p>
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); form.reset(emptyForm); setError(""); }}
                  className="flex size-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700"
                  title="Cancel"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
              <Field label="Name" error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} />
              </Field>
              <Field label="Description" error={form.formState.errors.description?.message}>
                <textarea {...form.register("description")} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-24 py-2" />
              </Field>
              <Field label="Status">
                <select {...form.register("status")} className="input">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
              <Button disabled={saveMutation.isPending} className="h-11 w-full">
                {saveMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Save Changes" : "Create Category"}
              </Button>
            </form>
          </article>
        )}

        <article className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Categories</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{categories.data?.length ?? 0} records</p>
            </div>
            <label className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(event) => setQ(event.target.value)} className="input pl-9" placeholder="Search categories" aria-label="Search categories" />
            </label>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Categories table">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Products</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage && <th className="px-4 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.data?.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-4 font-medium">
                      <span className="inline-flex items-center gap-2"><ClipboardList className="size-4 text-cyan-700" />{category.name}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{category.description ?? "-"}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{category.productCount}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${category.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{category.status}</span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => edit(category)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700" title="Edit"><Pencil className="size-4" /></button>
                          <ConfirmAction title="Delete category?" description={`“${category.name}” will be archived and removed from active selections. Existing transaction history is preserved.`} confirmLabel="Delete category" onConfirm={() => removeMutation.mutate(category.id)}>
                            <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300" title="Delete"><Trash2 className="size-4" /></button>
                          </ConfirmAction>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading categories...</p>}
            {!categories.isLoading && !categories.data?.length && <p className="py-12 text-center text-sm text-slate-500">No categories found</p>}
          </div>
        </article>
      </div>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}
