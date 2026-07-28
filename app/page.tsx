"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardList,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  ShieldCheck,
  RefreshCw,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard";

const chartColors = ["#0891b2", "#059669", "#d97706", "#7c3aed", "#475569", "#dc2626"];
const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default function Home() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    refetchInterval: 30_000,
  });
  const overview = dashboard.data?.overview;
  const monthlyFlow = dashboard.data?.monthlyStockMovement ?? [];
  const categoryMix = (dashboard.data?.categoryDistribution ?? []).map((item, index) => ({
    ...item,
    color: chartColors[index % chartColors.length],
  }));
  const productRows = dashboard.data?.watchlist ?? [];
  const recentTransactions = dashboard.data?.recentTransactions ?? [];
  const inventoryValue = dashboard.data?.inventoryValueByCategory ?? [];
  const stats = [
    { label: "Total Products", value: numberFormatter.format(overview?.totalProducts ?? 0), detail: "Active products", icon: Boxes, tone: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
    { label: "Categories", value: numberFormatter.format(overview?.totalCategories ?? 0), detail: "Active categories", icon: ClipboardList, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    { label: "Suppliers", value: numberFormatter.format(overview?.totalSuppliers ?? 0), detail: "Active suppliers", icon: Truck, tone: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
    { label: "Low Stock", value: numberFormatter.format(overview?.lowStockProducts ?? 0), detail: "Needs reorder", icon: AlertTriangle, tone: "bg-amber-50 text-amber-700 ring-amber-100" },
    { label: "Out of Stock", value: numberFormatter.format(overview?.outOfStockProducts ?? 0), detail: "No available quantity", icon: PackageMinus, tone: "bg-rose-50 text-rose-700 ring-rose-100" },
    { label: "Stock In Today", value: numberFormatter.format(overview?.todayStockIn ?? 0), detail: "Asia/Bangkok", icon: PackagePlus, tone: "bg-teal-50 text-teal-700 ring-teal-100" },
    { label: "Stock Out Today", value: numberFormatter.format(overview?.todayStockOut ?? 0), detail: "Asia/Bangkok", icon: PackageCheck, tone: "bg-violet-50 text-violet-700 ring-violet-100" },
    { label: "Inventory Value", value: currencyFormatter.format(overview?.inventoryValue ?? 0), detail: "Weighted average cost", icon: Warehouse, tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  ];

  return (
    <main className="min-h-full bg-stone-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="space-y-6 p-4 md:p-6">
            {dashboard.isError && (
              <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <span>Dashboard data is unavailable. Check the API and database connection.</span>
                <button onClick={() => dashboard.refetch()} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white" title="Retry dashboard">
                  <RefreshCw className="size-4" />
                </button>
              </div>
            )}
            <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Live inventory control</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">Dashboard Overview</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Real-time stock levels, movement, valuation, and operational alerts for warehouse teams.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => dashboard.refetch()} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
                  {dashboard.isFetching ? <RefreshCw className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
                  {dashboard.data ? new Date(dashboard.data.generatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
                </button>
                <Link href="/stock-in" className="flex h-10 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white shadow-sm shadow-cyan-900/10">
                  <PackagePlus className="size-4" /> Stock In
                </Link>
                <Link href="/stock-out" className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm">
                  <PackageMinus className="size-4" /> Stock Out
                </Link>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <article key={stat.label} className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${dashboard.isLoading ? "animate-pulse" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{stat.value}</p>
                      </div>
                      <span className={`flex size-10 items-center justify-center rounded-lg ring-1 ${stat.tone}`}>
                        <Icon className="size-5" />
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{stat.detail}</p>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">Monthly Stock Movement</h3>
                    <p className="text-sm text-slate-500">Stock in and stock out volume</p>
                  </div>
                  <ShieldCheck className="size-5 text-emerald-600" />
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFlow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="stockIn" fill="#0891b2" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="stockOut" fill="#d97706" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Product Distribution</h3>
                <p className="text-sm text-slate-500">By category</p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                        {categoryMix.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {categoryMix.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-medium text-slate-950">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <article className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4">
                  <h3 className="text-base font-semibold text-slate-950">Product Watchlist</h3>
                  <p className="text-sm text-slate-500">Stock status, supplier, and reorder threshold</p>
                </div>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Low stock product watchlist">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">SKU</th>
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Category</th>
                        <th className="px-4 py-3 font-semibold">Supplier</th>
                        <th className="px-4 py-3 font-semibold">Stock</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productRows.map((product) => (
                        <tr key={product.sku} className="hover:bg-slate-50">
                          <td className="px-4 py-4 font-mono text-xs text-slate-500">{product.sku}</td>
                          <td className="px-4 py-4 font-medium text-slate-950">{product.name}</td>
                          <td className="px-4 py-4 text-slate-600">{product.category}</td>
                          <td className="px-4 py-4 text-slate-600">{product.supplier}</td>
                          <td className="px-4 py-4 text-slate-600">{numberFormatter.format(product.stock)} / min {numberFormatter.format(product.minimumStock)}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                product.status === "Out of Stock"
                                  ? "bg-rose-50 text-rose-700"
                                  : product.status === "Low Stock"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {product.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <div className="space-y-4">
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Inventory Value Overview</h3>
                  <p className="text-sm text-slate-500">Cost value trend</p>
                  <div className="mt-4 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={inventoryValue}>
                        <defs>
                          <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0891b2" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#0891b2" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#0891b2" strokeWidth={3} fill="url(#valueFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Recent Transactions</h3>
                  <div className="mt-4 space-y-3">
                    {recentTransactions.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                        <span className={`flex size-9 items-center justify-center rounded-lg ${item.type === "Stock In" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {item.type === "Stock In" ? <PackagePlus className="size-4" /> : <PackageMinus className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-950">{item.product}</p>
                          <p className="text-xs text-slate-500">{item.user} at {new Date(item.occurredAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-950">{item.quantity}</span>
                      </div>
                    ))}
                    {!recentTransactions.length && !dashboard.isLoading && (
                      <p className="py-8 text-center text-sm text-slate-500">No recent transactions</p>
                    )}
                  </div>
                </article>

                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Recent Activities</h3>
                  <div className="mt-4 divide-y divide-slate-100">
                    {(dashboard.data?.recentActivities ?? []).map((activity) => (
                      <div key={activity.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {activity.action.replaceAll("_", " ").toLowerCase()}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{activity.user}</p>
                        </div>
                        <time className="shrink-0 text-xs text-slate-400">
                          {new Date(activity.occurredAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                    ))}
                    {!dashboard.data?.recentActivities.length && !dashboard.isLoading && (
                      <p className="py-8 text-center text-sm text-slate-500">No recent activities</p>
                    )}
                  </div>
                </article>
              </div>
            </section>
      </div>
    </main>
  );
}
