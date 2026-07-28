"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, PackageMinus, PackagePlus, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { getProducts } from "@/lib/products";
import { getTransactions, type Transaction, type TransactionType } from "@/lib/transactions";

const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 });
const currencyFormatter = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });

const transactionTypes: Array<{ value: TransactionType; label: string }> = [
  { value: "STOCK_IN", label: "Stock In" },
  { value: "STOCK_OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "RETURN_IN", label: "Return In" },
  { value: "RETURN_OUT", label: "Return Out" },
  { value: "REVERSAL", label: "Reversal" },
];

export default function TransactionsPage() {
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"" | TransactionType>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const products = useQuery({ queryKey: ["transaction-products"], queryFn: () => getProducts({ page: 1, limit: 100, sortBy: "name", sortOrder: "asc" }) });
  const transactions = useQuery({
    queryKey: ["transactions", productId, userId, type, dateFrom, dateTo, page],
    queryFn: () => getTransactions({ productId: productId || undefined, userId: userId || undefined, type: type || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit: 20 }),
  });
  const pageCount = transactions.data?.meta.pageCount ?? 1;

  function resetPage(value: string, setter: (next: string) => void) {
    setter(value);
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
          <select value={productId} onChange={(event) => resetPage(event.target.value, setProductId)} className="input" aria-label="Filter transactions by product"><option value="">All products</option>{products.data?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select>
          <select value={type} onChange={(event) => { setType(event.target.value as "" | TransactionType); setPage(1); }} className="input" aria-label="Filter transactions by type"><option value="">All types</option>{transactionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={userId} onChange={(event) => resetPage(event.target.value, setUserId)} className="input" aria-label="Filter transactions by user"><option value="">All users</option>{transactions.data?.users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select>
          <input type="date" value={dateFrom} onChange={(event) => resetPage(event.target.value, setDateFrom)} className="input" aria-label="Transaction start date" />
          <input type="date" value={dateTo} onChange={(event) => resetPage(event.target.value, setDateTo)} className="input" aria-label="Transaction end date" />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800"><h1 className="text-xl font-semibold">Inventory Transactions</h1><p className="mt-1 text-sm text-slate-500">{transactions.data?.meta.total ?? 0} records</p></div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Inventory transactions table">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Reference / Party</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{transactions.data?.items.map((row) => <TransactionRow key={row.id} row={row} />)}</tbody>
            </table>
            {transactions.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading transactions...</p>}
            {!transactions.isLoading && !transactions.data?.items.length && <p className="py-12 text-center text-sm text-slate-500">No transactions found</p>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800"><span>Page {page} of {Math.max(pageCount, 1)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40" title="Previous"><ChevronLeft className="size-4" /></button><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40" title="Next"><ChevronRight className="size-4" /></button></div></div>
        </section>
      </div>
    </main>
  );
}

function TransactionRow({ row }: { row: Transaction }) {
  const first = row.items[0];
  const delta = first ? first.quantityAfter - first.quantityBefore : 0;
  const presentation = transactionPresentation(row.type);
  const Icon = presentation.icon;
  return <tr className={row.status === "REVERSED" ? "bg-slate-50 opacity-60 dark:bg-slate-950" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}><td className="px-4 py-4 font-mono text-xs text-slate-500">{row.documentNumber}{row.status === "REVERSED" && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 font-sans text-[10px] text-slate-600">REVERSED</span>}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.tone}`}><Icon className="size-3" />{presentation.label}</span></td><td className="px-4 py-4 font-medium">{first?.product.name ?? "-"}<p className="font-mono text-xs text-slate-400">{first?.product.sku}</p></td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{delta > 0 ? "+" : delta < 0 ? "-" : ""}{numberFormatter.format(Math.abs(delta))} {first?.product.unit}</td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{currencyFormatter.format(row.value)}</td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{row.referenceNumber ?? row.supplier?.name ?? row.department ?? "-"}<p className="text-xs text-slate-400">{row.receiver ?? ""}</p></td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{row.createdBy.fullName}</td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{new Date(row.transactionDate).toLocaleString("th-TH")}</td></tr>;
}

function transactionPresentation(type: TransactionType) {
  if (type === "STOCK_IN") return { label: "Stock In", icon: PackagePlus, tone: "bg-emerald-50 text-emerald-700" };
  if (type === "STOCK_OUT") return { label: "Stock Out", icon: PackageMinus, tone: "bg-amber-50 text-amber-700" };
  if (type === "RETURN_IN") return { label: "Return In", icon: RotateCcw, tone: "bg-cyan-50 text-cyan-700" };
  if (type === "RETURN_OUT") return { label: "Return Out", icon: RotateCcw, tone: "bg-orange-50 text-orange-700" };
  if (type === "REVERSAL") return { label: "Reversal", icon: Undo2, tone: "bg-rose-50 text-rose-700" };
  return { label: "Adjustment", icon: SlidersHorizontal, tone: "bg-violet-50 text-violet-700" };
}
