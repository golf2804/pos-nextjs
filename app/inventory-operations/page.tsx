"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, RotateCcw, Save, SlidersHorizontal, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth/current-user";
import { getApiErrorMessage } from "@/lib/errors";
import { invalidateInventoryQueries } from "@/lib/inventory-query-cache";
import {
  getReconciliation,
  recordAdjustment,
  recordReturnIn,
  recordReturnOut,
  repairReconciliation,
  reverseTransaction,
} from "@/lib/inventory-operations";
import { getProductOptions, getProducts } from "@/lib/products";
import { getTransactions } from "@/lib/transactions";

type Mode = "adjustment" | "return-in" | "return-out" | "reversal" | "reconciliation";

const operationBaseSchema = z.object({
  productId: z.string(),
  supplierId: z.string(),
  transactionId: z.string(),
  quantity: z.number({ error: "Enter a valid quantity." }),
  countedQuantity: z.number({ error: "Enter a valid counted quantity." }),
  department: z.string().trim().max(120, "Department must not exceed 120 characters."),
  receiver: z.string().trim().max(120, "Receiver must not exceed 120 characters."),
  referenceNumber: z.string().trim().max(120, "Reference number must not exceed 120 characters."),
  reason: z.string().trim().max(300, "Reason must not exceed 300 characters."),
  notes: z.string().trim().max(1000, "Notes must not exceed 1,000 characters."),
  date: z.string().min(1, "Select a transaction date."),
});
type OperationValues = z.infer<typeof operationBaseSchema>;

const today = () => new Date().toISOString().slice(0, 10);
const initialValues = (): OperationValues => ({
  productId: "",
  supplierId: "",
  transactionId: "",
  quantity: 1,
  countedQuantity: 0,
  department: "",
  receiver: "",
  referenceNumber: "",
  reason: "",
  notes: "",
  date: today(),
});

export default function InventoryOperationsPage() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const [mode, setMode] = useState<Mode>("return-in");
  const [message, setMessage] = useState("");
  const canManage = me.data?.role === "ADMIN" || me.data?.role === "MANAGER";
  const isAdmin = me.data?.role === "ADMIN";
  const schema = useMemo(() => operationBaseSchema.superRefine((values, context) => {
    const requireText = (field: "department" | "receiver" | "reason", label: string, minimum = 1) => {
      if (values[field].length < minimum) context.addIssue({ code: "custom", path: [field], message: `${label} must contain at least ${minimum} character${minimum > 1 ? "s" : ""}.` });
    };
    if (mode !== "reversal" && !values.productId) context.addIssue({ code: "custom", path: ["productId"], message: "Select a product." });
    if ((mode === "return-in" || mode === "return-out") && values.quantity < 0.0001) context.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be at least 0.0001." });
    if (mode === "return-in") {
      requireText("department", "Department");
      requireText("receiver", "Receiver");
    }
    if (mode === "return-out" && !values.supplierId) context.addIssue({ code: "custom", path: ["supplierId"], message: "Select a supplier." });
    if (mode === "adjustment") {
      if (values.countedQuantity < 0) context.addIssue({ code: "custom", path: ["countedQuantity"], message: "Counted quantity cannot be negative." });
      requireText("reason", "Reason", 2);
      if (values.reason.length > 160) context.addIssue({ code: "custom", path: ["reason"], message: "Adjustment reason must not exceed 160 characters." });
    }
    if (mode === "reversal") {
      if (!values.transactionId) context.addIssue({ code: "custom", path: ["transactionId"], message: "Select a transaction." });
      requireText("reason", "Reason", 2);
    }
  }), [mode]);
  const form = useForm<OperationValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(),
    mode: "onBlur",
  });
  const productId = useWatch({ control: form.control, name: "productId" });

  const products = useQuery({
    queryKey: ["operation-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }),
  });
  const options = useQuery({ queryKey: ["product-options"], queryFn: getProductOptions });
  const transactions = useQuery({
    queryKey: ["reversible-transactions"],
    queryFn: () => getTransactions({ page: 1, limit: 100 }),
  });
  const reconciliation = useQuery({
    queryKey: ["reconciliation"],
    queryFn: getReconciliation,
    enabled: canManage,
  });
  const selectedProduct = products.data?.items.find((item) => item.id === productId);

  const operation = useMutation({
    mutationFn: async (values: OperationValues) => {
      if (mode === "adjustment") return recordAdjustment({ productId: values.productId, countedQuantity: values.countedQuantity, reason: values.reason.trim(), date: values.date, notes: optional(values.notes) });
      if (mode === "return-in") return recordReturnIn({ productId: values.productId, quantity: values.quantity, department: values.department.trim(), receiver: values.receiver.trim(), date: values.date, referenceNumber: optional(values.referenceNumber), notes: optional(values.notes) });
      if (mode === "return-out") return recordReturnOut({ productId: values.productId, supplierId: values.supplierId, quantity: values.quantity, date: values.date, referenceNumber: optional(values.referenceNumber), notes: optional(values.notes) });
      if (mode === "reversal") return reverseTransaction(values.transactionId, { reason: values.reason.trim(), date: values.date });
      throw new Error("Select an inventory operation.");
    },
    onSuccess: (data: { documentNumber?: string }) => {
      setMessage(`Recorded ${data.documentNumber ?? "inventory operation"} successfully.`);
      form.reset(initialValues());
      void invalidateInventoryQueries(queryClient);
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Unable to record inventory operation.")),
  });
  const repair = useMutation({
    mutationFn: (repairProductId: string) => repairReconciliation(repairProductId, {
      reason: "Approved inventory ledger reconciliation",
      date: new Date().toISOString(),
    }),
    onSuccess: () => {
      setMessage("Inventory ledger repaired.");
      void invalidateInventoryQueries(queryClient);
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Unable to repair inventory ledger.")),
  });

  const modes: Array<{ value: Mode; label: string; allowed: boolean }> = [
    { value: "return-in", label: "Return In", allowed: true },
    { value: "return-out", label: "Return Out", allowed: true },
    { value: "adjustment", label: "Adjustment", allowed: canManage },
    { value: "reversal", label: "Reversal", allowed: canManage },
    { value: "reconciliation", label: "Reconciliation", allowed: canManage },
  ];
  const submit = form.handleSubmit((values) => {
    setMessage("");
    if (mode === "return-out" && selectedProduct && values.quantity > selectedProduct.quantity) {
      form.setError("quantity", { message: `Only ${selectedProduct.quantity} ${selectedProduct.unit} available.` });
      return;
    }
    operation.mutate(values);
  });

  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center gap-3"><SlidersHorizontal className="size-5 text-cyan-700" /><div><h1 className="text-xl font-semibold">Inventory Operations</h1><p className="text-sm text-slate-500 dark:text-slate-400">Adjustments, returns, reversals, and ledger reconciliation</p></div></div>
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {modes.filter((item) => item.allowed).map((item) => (
            <button key={item.value} type="button" onClick={() => { setMode(item.value); setMessage(""); form.reset(initialValues()); }} className={`h-11 shrink-0 border-b-2 px-4 text-sm font-medium ${mode === item.value ? "border-cyan-700 text-cyan-700 dark:text-cyan-300" : "border-transparent text-slate-500"}`}>{item.label}</button>
          ))}
        </div>
        {message && <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{message}</p>}

        {mode === "reconciliation" ? (
          <ReconciliationTable data={reconciliation.data} loading={reconciliation.isLoading} canRepair={isAdmin} repairing={repair.isPending} onRepair={(id) => repair.mutate(id)} />
        ) : (
          <form onSubmit={(event) => { if (mode === "reversal") event.preventDefault(); else void submit(event); }} noValidate className="grid max-w-4xl gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
            {mode === "reversal" ? (
              <Field label="Transaction" error={form.formState.errors.transactionId?.message}><select {...form.register("transactionId")} aria-invalid={Boolean(form.formState.errors.transactionId)} className="input"><option value="">Select transaction</option>{transactions.data?.items.filter((item) => item.status === "CONFIRMED" && item.type !== "REVERSAL").map((item) => <option key={item.id} value={item.id}>{item.documentNumber} - {item.items[0]?.product.name}</option>)}</select></Field>
            ) : (
              <Field label="Product" error={form.formState.errors.productId?.message}><select {...form.register("productId")} aria-invalid={Boolean(form.formState.errors.productId)} className="input"><option value="">Select product</option>{products.data?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name} ({item.quantity} {item.unit})</option>)}</select></Field>
            )}
            {mode === "adjustment" && <Field label="Counted Quantity" error={form.formState.errors.countedQuantity?.message}><Input type="number" min="0" step="0.0001" {...form.register("countedQuantity", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.countedQuantity)} /></Field>}
            {(mode === "return-in" || mode === "return-out") && <Field label="Quantity" error={form.formState.errors.quantity?.message}><Input type="number" min="0.0001" step="0.0001" max={mode === "return-out" ? selectedProduct?.quantity : undefined} {...form.register("quantity", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.quantity)} /></Field>}
            {mode === "return-out" && <Field label="Supplier" error={form.formState.errors.supplierId?.message}><select {...form.register("supplierId")} aria-invalid={Boolean(form.formState.errors.supplierId)} className="input"><option value="">Select supplier</option>{options.data?.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
            {mode === "return-in" && <><Field label="Department" error={form.formState.errors.department?.message}><Input {...form.register("department")} aria-invalid={Boolean(form.formState.errors.department)} /></Field><Field label="Receiver" error={form.formState.errors.receiver?.message}><Input {...form.register("receiver")} aria-invalid={Boolean(form.formState.errors.receiver)} /></Field></>}
            {(mode === "adjustment" || mode === "reversal") && <Field label="Reason" error={form.formState.errors.reason?.message}><Input {...form.register("reason")} aria-invalid={Boolean(form.formState.errors.reason)} /></Field>}
            {(mode === "return-in" || mode === "return-out") && <Field label="Reference Number" error={form.formState.errors.referenceNumber?.message}><Input {...form.register("referenceNumber")} aria-invalid={Boolean(form.formState.errors.referenceNumber)} /></Field>}
            <Field label="Date" error={form.formState.errors.date?.message}><Input type="date" {...form.register("date")} aria-invalid={Boolean(form.formState.errors.date)} /></Field>
            {mode !== "reversal" && <div className="md:col-span-2"><Field label="Notes" error={form.formState.errors.notes?.message}><Input {...form.register("notes")} aria-invalid={Boolean(form.formState.errors.notes)} /></Field></div>}
            {mode === "reversal" ? (
              <div className="md:col-span-2">
                <ConfirmAction title="Reverse transaction?" description="This creates an opposite inventory movement and marks the selected transaction as reversed. The audit history cannot be removed." confirmLabel="Reverse transaction" onConfirm={() => void form.handleSubmit((values) => operation.mutate(values))()}>
                  <Button type="button" variant="destructive" disabled={operation.isPending} className="h-11 w-full"><Undo2 />Record Reversal</Button>
                </ConfirmAction>
              </div>
            ) : (
              <Button disabled={operation.isPending} className="h-11 md:col-span-2">{operation.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}Record Operation</Button>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

function ReconciliationTable({ data, loading, canRepair, repairing, onRepair }: {
  data: Awaited<ReturnType<typeof getReconciliation>> | undefined;
  loading: boolean;
  canRepair: boolean;
  repairing: boolean;
  onRepair: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" tabIndex={0} role="region" aria-label="Inventory adjustment history table">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Physical</th><th className="px-4 py-3">Ledger</th><th className="px-4 py-3">Difference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data?.items.map((item) => (
            <tr key={item.productId}>
              <td className="px-4 py-4 font-medium">{item.name}<p className="font-mono text-xs text-slate-400">{item.sku}</p></td>
              <td className="px-4 py-4">{item.productQuantity} {item.unit}</td><td className="px-4 py-4">{item.ledgerQuantity} {item.unit}</td><td className="px-4 py-4">{item.difference}</td>
              <td className="px-4 py-4">{item.status === "MATCH" ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />Match</span> : <span className="text-rose-700 dark:text-rose-300">Mismatch</span>}</td>
              <td className="px-4 py-4"><ConfirmAction title="Repair inventory ledger?" description={`This creates an adjustment for "${item.name}" so the ledger matches physical stock. The adjustment is recorded in transaction history.`} confirmLabel="Create adjustment" onConfirm={() => onRepair(item.productId)}><button type="button" disabled={!canRepair || item.status === "MATCH" || repairing} title="Repair ledger" className="flex size-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-30 dark:border-slate-700"><RotateCcw className="size-4" /></button></ConfirmAction></td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p className="p-8 text-center text-sm text-slate-500">Loading reconciliation...</p>}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}

function optional(value: string) {
  return value.trim() || undefined;
}
