"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Boxes, ChevronLeft, ChevronRight, Pencil, Search, Trash2, Warehouse } from "lucide-react";
import { createProduct, deleteProduct, getProductOptions, getProducts, type Product, type ProductFormInput, updateProduct } from "@/lib/products";
import { canManageInventory, useCurrentUser } from "@/lib/auth/current-user";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { ProductForm } from "@/components/products/product-form";
import { getApiErrorMessage } from "@/lib/errors";

type SortBy = "name" | "sku" | "quantity" | "sellingPrice" | "costPrice" | "createdAt";
type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

export default function ProductsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-stone-50 p-6 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Loading products...</main>}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const canManage = canManageInventory(me.data?.role);
  const initialQuery = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState<StockFilter>("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formError, setFormError] = useState("");
  const [formResetSignal, setFormResetSignal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const options = useQuery({ queryKey: ["product-options"], queryFn: getProductOptions });
  const products = useQuery({
    queryKey: ["products", debouncedQ, categoryId, stockStatus, page, sortBy, sortOrder],
    queryFn: () => getProducts({ q: debouncedQ, categoryId: categoryId || undefined, stockStatus, page, limit: 10, sortBy, sortOrder }),
  });

  const saveMutation = useMutation({
    mutationFn: ({ input, productId }: { input: ProductFormInput; productId?: string }) => {
      if (!productId) return createProduct(input);
      const { quantity, ...changes } = input;
      void quantity;
      return updateProduct(productId, changes);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      setFormResetSignal((value) => value + 1);
      setFormError("");
    },
    onError: (error) => setFormError(getApiErrorMessage(error, "Unable to save product.")),
  });
  const removeMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const stats = useMemo(() => {
    const rows = products.data?.items ?? [];
    return {
      total: products.data?.meta.total ?? 0,
      low: rows.filter((item) => item.stockStatus === "LOW_STOCK").length,
      out: rows.filter((item) => item.stockStatus === "OUT_OF_STOCK").length,
      value: rows.reduce((sum, item) => sum + item.quantity * item.averageCost, 0),
    };
  }, [products.data]);

  function editProduct(product: Product) {
    setEditing(product);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const rows = products.data?.items ?? [];
  const pageCount = products.data?.meta.pageCount ?? 1;

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white"><Warehouse className="size-5" /></span><span className="font-semibold">Inventory</span></Link>
          <div className="ml-auto text-sm font-medium text-cyan-700">Product Management</div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-7xl gap-5 p-4 md:p-6 ${canManage ? "xl:grid-cols-[380px_minmax(0,1fr)]" : ""}`}>
        {canManage && <section className="space-y-4">
          <ProductForm
            key={editing?.id ?? `new-${formResetSignal}`}
            editing={editing}
            categories={options.data?.categories ?? []}
            suppliers={options.data?.suppliers ?? []}
            pending={saveMutation.isPending}
            serverError={formError}
            onSubmit={(input) => {
              setFormError("");
              saveMutation.mutate({ input, productId: editing?.id });
            }}
            onCancel={() => {
              setEditing(null);
              setFormError("");
            }}
          />
        </section>}

        <section className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4"><Stat label="Products" value={numberFormatter.format(stats.total)} /><Stat label="Low Stock" value={numberFormatter.format(stats.low)} /><Stat label="Out" value={numberFormatter.format(stats.out)} /><Stat label="Page Value" value={currencyFormatter.format(stats.value)} /></div>
          <article className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_180px_170px_170px]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" placeholder="Search product, SKU, barcode" /></label><select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="input" aria-label="Filter by category"><option value="">All categories</option>{options.data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value as StockFilter); setPage(1); }} className="input" aria-label="Filter by stock status"><option value="all">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></select><button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium"><ArrowDownUp className="size-4" /> {sortOrder.toUpperCase()}</button></div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Products table"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["sku", "name", "quantity", "costPrice", "sellingPrice", "createdAt"].map((column) => <th key={column} className="px-4 py-3 font-semibold"><button onClick={() => setSortBy(column as SortBy)}>{column}</button></th>)}<th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Supplier</th><th className="px-4 py-3 font-semibold">Status</th>{canManage && <th className="px-4 py-3 font-semibold">Actions</th>}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((product) => <ProductRow key={product.id} product={product} canManage={canManage} onEdit={editProduct} onDelete={(id) => removeMutation.mutate(id)} />)}</tbody></table>{!rows.length && !products.isLoading && <p className="py-12 text-center text-sm text-slate-500">No products found</p>}{products.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading products...</p>}</div>
            <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600"><span>Page {page} of {Math.max(pageCount, 1)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40" title="Previous"><ChevronLeft className="size-4" /></button><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40" title="Next"><ChevronRight className="size-4" /></button></div></div>
          </article>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>;
}

function ProductRow({ product, canManage, onEdit, onDelete }: { product: Product; canManage: boolean; onEdit: (product: Product) => void; onDelete: (id: string) => void }) {
  const stockTone = product.stockStatus === "OUT_OF_STOCK" ? "bg-rose-50 text-rose-700" : product.stockStatus === "LOW_STOCK" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <tr className="hover:bg-slate-50"><td className="px-4 py-4 font-mono text-xs text-slate-500">{product.sku}</td><td className="px-4 py-4"><div className="flex items-center gap-3">{product.imageUrl ? <Image src={product.imageUrl} alt="" width={40} height={40} className="size-10 rounded-md object-cover" /> : <span className="flex size-10 items-center justify-center rounded-md bg-slate-100"><Boxes className="size-4 text-slate-400" /></span>}<div><p className="font-medium text-slate-950">{product.name}</p><p className="text-xs text-slate-500">{product.barcode ?? "No barcode"}</p></div></div></td><td className="px-4 py-4 text-slate-600">{numberFormatter.format(product.quantity)} {product.unit}<p className="text-xs text-slate-400">min {numberFormatter.format(product.minimumStock)}</p></td><td className="px-4 py-4 text-slate-600">{currencyFormatter.format(product.costPrice)}</td><td className="px-4 py-4 text-slate-600">{currencyFormatter.format(product.sellingPrice)}</td><td className="px-4 py-4 text-slate-600">{new Date(product.createdAt).toLocaleDateString("th-TH")}</td><td className="px-4 py-4 text-slate-600">{product.category.name}</td><td className="px-4 py-4 text-slate-600">{product.supplier?.name ?? "-"}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockTone}`}>{product.stockStatus.replaceAll("_", " ")}</span></td>{canManage && <td className="px-4 py-4"><div className="flex gap-2"><button onClick={() => onEdit(product)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200" title="Edit"><Pencil className="size-4" /></button><ConfirmAction title="Delete product?" description={`“${product.name}” (${product.sku}) will be archived. Inventory history remains available for audit.`} confirmLabel="Delete product" onConfirm={() => onDelete(product.id)}><button type="button" className="flex size-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700" title="Delete"><Trash2 className="size-4" /></button></ConfirmAction></div></td>}</tr>;
}
