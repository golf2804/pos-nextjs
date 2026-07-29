"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, ClipboardList, FileText, LoaderCircle, Search, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchInventory } from "@/lib/search";

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const results = useQuery({
    queryKey: ["global-search", debouncedQ],
    queryFn: () => searchInventory(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });
  const total = useMemo(() => {
    if (!results.data) return 0;
    return results.data.products.length
      + results.data.categories.length
      + results.data.suppliers.length
      + results.data.transactions.length;
  }, [results.data]);
  const showResults = focused && q.trim().length >= 2;

  function navigate(href: string) {
    setFocused(false);
    setMobileOpen(false);
    router.push(href);
  }

  return (
    <div className={mobileOpen ? "fixed inset-x-3 top-3 z-50 md:relative md:inset-auto md:z-auto" : "relative"}>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => { setMobileOpen(true); setFocused(true); }}
          className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden"
          title="Global search"
        >
          <Search className="size-4" />
        </button>
      )}
      <div className={mobileOpen ? "relative block" : "relative hidden w-80 md:block"}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus={mobileOpen}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          className="search-input-motion h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-950 dark:focus:text-slate-50 dark:focus:ring-cyan-500/20"
          placeholder="Search inventory"
          aria-label="Search products, categories, suppliers, and transactions"
        />
        {(q || mobileOpen) && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (q) setQ("");
              else setMobileOpen(false);
            }}
            className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={q ? "Clear search" : "Close search"}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute right-0 top-11 z-50 max-h-[min(70vh,560px)] w-full min-w-[min(92vw,360px)] animate-pop-in overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900/98 dark:shadow-cyan-950/10 md:w-[420px]">
          {results.isFetching && !results.data && (
            <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Searching...</p>
          )}
          {results.isError && (
            <p className="px-3 py-8 text-center text-sm text-rose-600 dark:text-rose-300">Search is temporarily unavailable.</p>
          )}
          {results.data && total === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">No results for &quot;{debouncedQ}&quot;</p>
          )}
          {results.data?.products.length ? (
            <ResultGroup label="Products">
              {results.data.products.map((item) => (
                <ResultButton key={item.id} icon={Boxes} title={item.name} detail={`${item.sku} - ${item.quantity} ${item.unit}`} onClick={() => navigate(`/products?q=${encodeURIComponent(item.sku)}`)} />
              ))}
            </ResultGroup>
          ) : null}
          {results.data?.categories.length ? (
            <ResultGroup label="Categories">
              {results.data.categories.map((item) => (
                <ResultButton key={item.id} icon={ClipboardList} title={item.name} detail={item.description ?? "Category"} onClick={() => navigate(`/categories?q=${encodeURIComponent(item.name)}`)} />
              ))}
            </ResultGroup>
          ) : null}
          {results.data?.suppliers.length ? (
            <ResultGroup label="Suppliers">
              {results.data.suppliers.map((item) => (
                <ResultButton key={item.id} icon={Truck} title={item.name} detail={item.email ?? item.phone ?? "Supplier"} onClick={() => navigate(`/suppliers?q=${encodeURIComponent(item.name)}`)} />
              ))}
            </ResultGroup>
          ) : null}
          {results.data?.transactions.length ? (
            <ResultGroup label="Transactions">
              {results.data.transactions.map((item) => (
                <ResultButton key={item.id} icon={FileText} title={item.documentNumber} detail={`${item.type.replaceAll("_", " ")} - ${item.items[0]?.product.name ?? "Inventory"}`} onClick={() => navigate(`/transactions?q=${encodeURIComponent(item.documentNumber)}`)} />
              ))}
            </ResultGroup>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="not-last:mb-2">
      <p className="px-2 py-1.5 text-xs font-semibold uppercase text-slate-400">{label}</p>
      <div>{children}</div>
    </section>
  );
}

function ResultButton({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof Search;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="group flex w-full animate-result-rise items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-slate-50 hover:shadow-sm dark:hover:bg-slate-800/80">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-cyan-700 transition-transform group-hover:scale-105 dark:bg-slate-800 dark:text-cyan-300"><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</span>
      </span>
    </button>
  );
}
