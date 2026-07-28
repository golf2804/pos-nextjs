"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Mail, Pencil, Phone, Save, Search, Trash2, Truck, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  type Supplier,
  type SupplierInput,
  updateSupplier,
} from "@/lib/suppliers";
import { canManageInventory, useCurrentUser } from "@/lib/auth/current-user";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/errors";

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name must contain at least 2 characters.").max(160, "Supplier name must not exceed 160 characters."),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  phone: z.string().trim().max(40, "Phone number must not exceed 40 characters."),
  address: z.string().trim().max(500, "Address must not exceed 500 characters."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

const emptyForm: SupplierFormValues = {
  name: "",
  email: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading suppliers...</div>}>
      <SuppliersContent />
    </Suspense>
  );
}

function SuppliersContent() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const canManage = canManageInventory(me.data?.role);
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [error, setError] = useState("");
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyForm,
    mode: "onBlur",
  });

  const suppliers = useQuery({
    queryKey: ["suppliers", q],
    queryFn: () => getSuppliers(q),
  });
  const saveMutation = useMutation({
    mutationFn: (input: SupplierInput) =>
      editing
        ? updateSupplier(editing.id, input)
        : createSupplier(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["product-options"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      form.reset(emptyForm);
      setError("");
    },
    onError: (err) => setError(getApiErrorMessage(err, "Unable to save supplier.")),
  });
  const removeMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["product-options"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function edit(supplier: Supplier) {
    setEditing(supplier);
    form.reset({
      name: supplier.name,
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      status: supplier.status === "ARCHIVED" ? "INACTIVE" : supplier.status,
    });
    setError("");
  }

  const submit = form.handleSubmit((values) => {
    setError("");
    saveMutation.mutate({
      ...values,
      name: values.name.trim(),
      email: values.email.trim() || undefined,
      phone: values.phone.trim() || undefined,
      address: values.address.trim() || undefined,
    });
  });

  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <div className={`mx-auto grid max-w-7xl gap-5 ${canManage ? "lg:grid-cols-[360px_minmax(0,1fr)]" : ""}`}>
        {canManage && (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{editing ? "Update Supplier" : "Create Supplier"}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Supplier contact and address details</p>
              </div>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); form.reset(emptyForm); setError(""); }} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700" title="Cancel">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
              <Field label="Supplier Name" error={form.formState.errors.name?.message}><Input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} /></Field>
              <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email)} /></Field>
              <Field label="Phone Number" error={form.formState.errors.phone?.message}><Input {...form.register("phone")} aria-invalid={Boolean(form.formState.errors.phone)} /></Field>
              <Field label="Address" error={form.formState.errors.address?.message}><textarea {...form.register("address")} aria-invalid={Boolean(form.formState.errors.address)} className="input min-h-24 py-2" /></Field>
              <Field label="Status">
                <select {...form.register("status")} className="input">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
              <Button disabled={saveMutation.isPending} className="h-11 w-full">
                {saveMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Save Changes" : "Create Supplier"}
              </Button>
            </form>
          </article>
        )}

        <article className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Suppliers</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{suppliers.data?.length ?? 0} records</p>
            </div>
            <label className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(event) => setQ(event.target.value)} className="input pl-9" placeholder="Search suppliers" aria-label="Search suppliers" />
            </label>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Suppliers table">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Products</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage && <th className="px-4 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliers.data?.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-4 font-medium"><span className="inline-flex items-center gap-2"><Truck className="size-4 text-cyan-700" />{supplier.name}</span></td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      <p className="inline-flex items-center gap-2"><Mail className="size-3" />{supplier.email ?? "-"}</p>
                      <p className="mt-1 flex items-center gap-2"><Phone className="size-3" />{supplier.phone ?? "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{supplier.address ?? "-"}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{supplier.productCount}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${supplier.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{supplier.status}</span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => edit(supplier)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700" title="Edit"><Pencil className="size-4" /></button>
                          <ConfirmAction title="Delete supplier?" description={`“${supplier.name}” will be archived and removed from active selections. Existing transaction history is preserved.`} confirmLabel="Delete supplier" onConfirm={() => removeMutation.mutate(supplier.id)}>
                            <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300" title="Delete"><Trash2 className="size-4" /></button>
                          </ConfirmAction>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {suppliers.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading suppliers...</p>}
            {!suppliers.isLoading && !suppliers.data?.length && <p className="py-12 text-center text-sm text-slate-500">No suppliers found</p>}
          </div>
        </article>
      </div>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}
