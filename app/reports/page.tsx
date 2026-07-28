"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Inbox,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadReport, getReport, type ReportPeriod } from "@/lib/reports";

const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

type ExportFormat = "excel" | "pdf";

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [lastExport, setLastExport] = useState<ExportFormat | null>(null);
  const rangeError = dateFrom && dateTo && dateFrom > dateTo
    ? "Start date must be before or equal to end date."
    : "";
  const report = useQuery({
    queryKey: ["reports", period, dateFrom, dateTo],
    queryFn: () => getReport(period, dateFrom || undefined, dateTo || undefined),
    enabled: !rangeError,
  });
  const exportReport = useMutation({
    mutationFn: (format: ExportFormat) =>
      downloadReport(period, format, dateFrom || undefined, dateTo || undefined),
    onMutate: () => {
      setExportMessage("");
      setLastExport(null);
    },
    onSuccess: (filename, format) => {
      setExportMessage(`Downloaded ${filename}`);
      setLastExport(format);
    },
    onError: () => setExportMessage("Report download failed. Please try again."),
  });
  const summary = report.data?.summary;
  const movement = report.data?.movement ?? [];
  const reportError = report.error instanceof Error ? report.error.message : "Unable to load report.";

  return (
    <main className="min-h-full bg-stone-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
            <FileBarChart className="size-5" />
            <span className="text-sm font-semibold">Inventory Reports</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Inventory Movement</h1>
        </div>

        <section className="border-y border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 md:rounded-lg md:border">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[180px_1fr_1fr_auto_auto]">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
              className="input"
              aria-label="Report period"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="input"
              aria-label="Start date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="input"
              aria-label="End date"
            />
            <ExportButton
              format="excel"
              pending={exportReport.isPending && exportReport.variables === "excel"}
              completed={lastExport === "excel"}
              disabled={Boolean(rangeError) || exportReport.isPending}
              onClick={() => exportReport.mutate("excel")}
            />
            <ExportButton
              format="pdf"
              pending={exportReport.isPending && exportReport.variables === "pdf"}
              completed={lastExport === "pdf"}
              disabled={Boolean(rangeError) || exportReport.isPending}
              onClick={() => exportReport.mutate("pdf")}
            />
          </div>
          {rangeError && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-400">{rangeError}</p>}
          {exportMessage && (
            <p
              role="status"
              className={`mt-3 text-sm ${exportReport.isError ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}
            >
              {exportMessage}
            </p>
          )}
        </section>

        {report.isError && (
          <section role="alert" className="flex flex-col gap-4 border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Report could not be loaded</p>
              <p className="mt-1 break-words text-sm">{reportError}</p>
            </div>
            <button
              type="button"
              onClick={() => report.refetch()}
              className="flex h-10 items-center justify-center gap-2 border border-rose-300 bg-white px-3 text-sm font-medium dark:border-rose-800 dark:bg-slate-950"
            >
              <RefreshCw className="size-4" />
              Retry
            </button>
          </section>
        )}

        {report.isLoading ? (
          <ReportSkeleton />
        ) : !report.isError ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Stock In" value={numberFormatter.format(summary?.stockIn ?? 0)} />
              <Stat label="Stock Out" value={numberFormatter.format(summary?.stockOut ?? 0)} />
              <Stat label="Stock In Value" value={currencyFormatter.format(summary?.stockInValue ?? 0)} />
              <Stat label="Stock Out Value" value={currencyFormatter.format(summary?.stockOutValue ?? 0)} />
            </section>

            <section className="border-y border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:rounded-lg md:border">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Movement Overview</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {report.data?.range.from.slice(0, 10)} to {report.data?.range.to.slice(0, 10)}
                  </p>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{movement.length} periods</span>
              </div>
              {movement.length ? (
                <div className="mt-5 h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={movement}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="stockIn" name="Stock In" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="stockOut" name="Stock Out" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-80 flex-col items-center justify-center text-center">
                  <span className="flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Inbox className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">No inventory movements</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No transactions were recorded in this date range.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ExportButton({
  format,
  pending,
  completed,
  disabled,
  onClick,
}: {
  format: ExportFormat;
  pending: boolean;
  completed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isExcel = format === "excel";
  const Icon = isExcel ? FileSpreadsheet : FileText;
  const label = isExcel ? "Export Excel" : "Export PDF";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={`Download report as ${isExcel ? "Excel workbook" : "PDF document"}`}
      aria-label={label}
      className={`group flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-sm transition duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:translate-y-0 ${
        isExcel
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 focus-visible:ring-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:focus-visible:ring-emerald-900"
          : "border-rose-700 bg-rose-700 text-white focus-visible:ring-rose-200 dark:border-rose-600 dark:bg-rose-700 dark:focus-visible:ring-rose-950"
      }`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : completed ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          <Icon className="size-4 transition-transform duration-150 group-enabled:group-hover:-translate-y-0.5" />
        )}
      </span>
      <span>{pending ? "Preparing..." : completed ? "Downloaded" : label}</span>
    </button>
  );
}

function ReportSkeleton() {
  return (
    <div aria-label="Loading report" role="status" className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </section>
      <div className="h-[430px] animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:rounded-lg">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </article>
  );
}
