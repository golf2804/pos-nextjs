"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, PackagePlus, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/errors";
import { invalidateInventoryQueries } from "@/lib/inventory-query-cache";
import { getProductOptions, getProducts } from "@/lib/products";
import { recordStockIn, type StockInInput } from "@/lib/stock";

const stockInSchema = z.object({
  productId: z.string().min(1, "Select a product."),
  supplierId: z.string().min(1, "Select a supplier."),
  quantity: z.number({ error: "Enter a valid quantity." }).positive("Quantity must be greater than 0."),
  costPrice: z.number({ error: "Enter a valid cost price." }).min(0, "Cost price cannot be negative."),
  date: z.string().min(1, "Select a transaction date."),
  notes: z.string().max(1000, "Notes must not exceed 1,000 characters."),
});

type StockInForm = z.infer<typeof stockInSchema>;
const today = () => new Date().toISOString().slice(0, 10);
const defaults = (): StockInForm => ({
  productId: "",
  supplierId: "",
  quantity: 1,
  costPrice: 0,
  date: today(),
  notes: "",
});

export default function StockInPage() {
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["product-options"], queryFn: getProductOptions });
  const products = useQuery({
    queryKey: ["stock-in-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
  });
  const form = useForm<StockInForm>({
    resolver: zodResolver(stockInSchema),
    defaultValues: defaults(),
    mode: "onBlur",
  });
  const mutation = useMutation({
    mutationFn: ({ input, requestKey }: { input: StockInInput; requestKey: string }) =>
      recordStockIn(input, requestKey),
    onSuccess: (data: { documentNumber?: string }) => {
      void invalidateInventoryQueries(queryClient);
      form.reset(defaults());
      form.clearErrors("root");
      form.setError("root.success", { message: `Recorded ${data.documentNumber ?? "stock in"} successfully.` });
    },
    onError: (error) => form.setError("root.server", {
      message: getApiErrorMessage(error, "Unable to record stock in."),
    }),
  });

  const submit = form.handleSubmit((values) => {
    form.clearErrors("root");
    mutation.mutate({
      input: { ...values, notes: values.notes.trim() || undefined },
      requestKey: crypto.randomUUID(),
    });
  });
  const rootErrors = form.formState.errors.root as {
    server?: { message?: string };
    success?: { message?: string };
  } | undefined;

  return (
    <StockPage
      title="Stock In"
      description="Record incoming inventory and transaction history"
      icon={<PackagePlus className="size-5" />}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
        <Field label="Product" error={form.formState.errors.productId?.message}>
          <select {...form.register("productId")} aria-invalid={Boolean(form.formState.errors.productId)} className="input">
            <option value="">Select product</option>
            {products.data?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
          </select>
        </Field>
        <Field label="Supplier" error={form.formState.errors.supplierId?.message}>
          <select {...form.register("supplierId")} aria-invalid={Boolean(form.formState.errors.supplierId)} className="input">
            <option value="">Select supplier</option>
            {options.data?.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Quantity" error={form.formState.errors.quantity?.message}>
          <Input type="number" min="0.0001" step="0.0001" {...form.register("quantity", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.quantity)} />
        </Field>
        <Field label="Cost Price" error={form.formState.errors.costPrice?.message}>
          <Input type="number" min="0" step="0.01" {...form.register("costPrice", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.costPrice)} />
        </Field>
        <Field label="Date" error={form.formState.errors.date?.message}>
          <Input type="date" {...form.register("date")} aria-invalid={Boolean(form.formState.errors.date)} />
        </Field>
        <Field label="Notes" error={form.formState.errors.notes?.message}>
          <Input {...form.register("notes")} aria-invalid={Boolean(form.formState.errors.notes)} />
        </Field>
        <FormStatus errors={rootErrors} />
        <div className="md:col-span-2">
          <Button disabled={mutation.isPending} className="h-11 w-full bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-600">
            {mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
            Record Stock In
          </Button>
        </div>
      </form>
    </StockPage>
  );
}

function StockPage({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <article className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{icon}</span><div><h1 className="text-xl font-semibold">{title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p></div></div>
        <div className="mt-6">{children}</div>
      </article>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}

function FormStatus({ errors }: { errors?: { server?: { message?: string }; success?: { message?: string } } }) {
  const message = errors?.server?.message ?? errors?.success?.message;
  if (!message) return null;
  const failed = Boolean(errors?.server);
  return <p role={failed ? "alert" : "status"} className={`md:col-span-2 rounded-lg p-3 text-sm ${failed ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{message}</p>;
}
