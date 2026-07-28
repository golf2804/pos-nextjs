"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, PackageMinus, Save } from "lucide-react";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/errors";
import { invalidateInventoryQueries } from "@/lib/inventory-query-cache";
import { getProducts } from "@/lib/products";
import { recordStockOut, type StockOutInput } from "@/lib/stock";

const stockOutSchema = z.object({
  productId: z.string().min(1, "Select a product."),
  quantity: z.number({ error: "Enter a valid quantity." }).positive("Quantity must be greater than 0."),
  department: z.string().trim().min(1, "Department is required.").max(120, "Department must not exceed 120 characters."),
  receiver: z.string().trim().min(1, "Receiver is required.").max(120, "Receiver must not exceed 120 characters."),
  date: z.string().min(1, "Select a transaction date."),
  notes: z.string().max(1000, "Notes must not exceed 1,000 characters."),
});

type StockOutForm = z.infer<typeof stockOutSchema>;
const today = () => new Date().toISOString().slice(0, 10);
const defaults = (): StockOutForm => ({ productId: "", quantity: 1, department: "", receiver: "", date: today(), notes: "" });
const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export default function StockOutPage() {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ["stock-out-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
  });
  const form = useForm<StockOutForm>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: defaults(),
    mode: "onBlur",
  });
  const productId = useWatch({ control: form.control, name: "productId" });
  const selectedProduct = useMemo(
    () => products.data?.items.find((item) => item.id === productId),
    [productId, products.data],
  );
  const mutation = useMutation({
    mutationFn: ({ input, requestKey }: { input: StockOutInput; requestKey: string }) =>
      recordStockOut(input, requestKey),
    onSuccess: (data: { documentNumber?: string }) => {
      void invalidateInventoryQueries(queryClient);
      form.reset(defaults());
      form.setError("root.success", { message: `Recorded ${data.documentNumber ?? "stock out"} successfully.` });
    },
    onError: (error) => form.setError("root.server", {
      message: getApiErrorMessage(error, "Unable to record stock out."),
    }),
  });

  const submit = form.handleSubmit((values) => {
    form.clearErrors("root");
    if (selectedProduct && values.quantity > selectedProduct.quantity) {
      form.setError("quantity", {
        type: "validate",
        message: `Only ${numberFormatter.format(selectedProduct.quantity)} ${selectedProduct.unit} available.`,
      });
      return;
    }
    mutation.mutate({
      input: {
        ...values,
        department: values.department.trim(),
        receiver: values.receiver.trim(),
        notes: values.notes.trim() || undefined,
      },
      requestKey: crypto.randomUUID(),
    });
  });

  const rootErrors = form.formState.errors.root as { server?: { message?: string }; success?: { message?: string } } | undefined;
  const rootMessage = rootErrors?.server?.message ?? rootErrors?.success?.message;

  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <article className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><PackageMinus className="size-5" /></span><div><h1 className="text-xl font-semibold">Stock Out</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Issue inventory to departments and prevent negative stock</p></div></div>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
          <Field label="Product" error={form.formState.errors.productId?.message}>
            <select {...form.register("productId")} aria-invalid={Boolean(form.formState.errors.productId)} className="input">
              <option value="">Select product</option>
              {products.data?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name} ({numberFormatter.format(item.quantity)} {item.unit})</option>)}
            </select>
          </Field>
          <Field label="Available Stock">
            <Input value={selectedProduct ? `${numberFormatter.format(selectedProduct.quantity)} ${selectedProduct.unit}` : "-"} readOnly className="bg-slate-50 text-slate-500 dark:bg-slate-800" />
          </Field>
          <Field label="Quantity" error={form.formState.errors.quantity?.message}>
            <Input type="number" min="0.0001" step="0.0001" max={selectedProduct?.quantity} {...form.register("quantity", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.quantity)} />
          </Field>
          <Field label="Department" error={form.formState.errors.department?.message}>
            <Input {...form.register("department")} aria-invalid={Boolean(form.formState.errors.department)} />
          </Field>
          <Field label="Receiver" error={form.formState.errors.receiver?.message}>
            <Input {...form.register("receiver")} aria-invalid={Boolean(form.formState.errors.receiver)} />
          </Field>
          <Field label="Date" error={form.formState.errors.date?.message}>
            <Input type="date" {...form.register("date")} aria-invalid={Boolean(form.formState.errors.date)} />
          </Field>
          <div className="md:col-span-2"><Field label="Notes" error={form.formState.errors.notes?.message}><Input {...form.register("notes")} aria-invalid={Boolean(form.formState.errors.notes)} /></Field></div>
          {rootMessage && <p role={rootErrors?.server ? "alert" : "status"} className={`md:col-span-2 rounded-lg p-3 text-sm ${rootErrors?.server ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{rootMessage}</p>}
          <div className="md:col-span-2">
            <Button disabled={mutation.isPending} className="h-11 w-full bg-amber-700 hover:bg-amber-600 dark:bg-amber-700 dark:hover:bg-amber-600">
              {mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
              Record Stock Out
            </Button>
          </div>
        </form>
      </article>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}
