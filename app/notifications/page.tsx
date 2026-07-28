"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  PackageMinus,
  RefreshCw,
} from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationStatus,
  type NotificationType,
} from "@/lib/notifications";

const pageSize = 10;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"" | NotificationType>("");
  const [status, setStatus] = useState<NotificationStatus>("active");
  const [page, setPage] = useState(1);
  const notifications = useQuery({
    queryKey: ["notifications", "list", type, status, page],
    queryFn: () => getNotifications({
      type: type || undefined,
      status,
      page,
      limit: pageSize,
    }),
    refetchInterval: 30_000,
  });
  const refreshNotifications = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refreshNotifications,
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refreshNotifications,
  });
  const meta = notifications.data?.meta;

  function changeFilter(next: string, setter: (value: never) => void) {
    setter(next as never);
    setPage(1);
  }

  return (
    <main className="min-h-full bg-stone-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
              <Bell className="size-5" />
              <span className="text-sm font-semibold">Stock Alerts</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Notification Center</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {notifications.data?.unreadCount ?? 0} unread alerts
            </p>
          </div>
          <button
            type="button"
            disabled={!notifications.data?.unreadCount || readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            {readAllMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            Mark all read
          </button>
        </div>

        <section className="grid gap-3 border-y border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 md:rounded-lg md:border">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Alert type
            <select
              value={type}
              onChange={(event) => changeFilter(event.target.value, setType)}
              className="input mt-2"
            >
              <option value="">All types</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Status
            <select
              value={status}
              onChange={(event) => changeFilter(event.target.value, setStatus)}
              className="input mt-2"
            >
              <option value="active">Active</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </label>
        </section>

        {notifications.isError && (
          <div role="alert" className="flex items-center gap-3 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="size-5 shrink-0" />
            <span className="flex-1">Notifications could not be loaded.</span>
            <button type="button" onClick={() => notifications.refetch()} className="flex size-9 items-center justify-center rounded-lg border border-rose-300" title="Retry">
              <RefreshCw className="size-4" />
            </button>
          </div>
        )}

        <section className="space-y-3">
          {notifications.isLoading && Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
          {notifications.data?.items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              reading={readMutation.isPending && readMutation.variables === item.id}
              onRead={() => readMutation.mutate(item.id)}
            />
          ))}
          {!notifications.isLoading && !notifications.isError && !notifications.data?.items.length && (
            <div className="flex min-h-64 flex-col items-center justify-center border-y border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 md:rounded-lg md:border">
              <span className="flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Inbox className="size-6" />
              </span>
              <h2 className="mt-4 font-semibold">No matching notifications</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">There are no alerts for the selected filters.</p>
            </div>
          )}
        </section>

        {meta && meta.total > 0 && (
          <footer className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{meta.total} results · Page {meta.page} of {Math.max(meta.pageCount, 1)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                title="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= meta.pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                title="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </footer>
        )}
      </div>
    </main>
  );
}

function NotificationRow({
  item,
  reading,
  onRead,
}: {
  item: NotificationItem;
  reading: boolean;
  onRead: () => void;
}) {
  const out = item.type === "OUT_OF_STOCK";
  const resolved = Boolean(item.resolvedAt);
  const unread = !item.readAt && !resolved;
  const Icon = out ? PackageMinus : AlertTriangle;
  const tone = resolved
    ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    : out
      ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
      : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30";
  const iconTone = resolved
    ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
    : out
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

  return (
    <article className={`border p-4 shadow-sm md:rounded-lg ${tone} ${resolved ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          {resolved ? <Check className="size-5" /> : <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{item.title}</h2>
            {resolved && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">Resolved</span>}
            {unread && <span className="size-2 rounded-full bg-cyan-600" title="Unread" />}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{item.product.sku} · {item.product.name}</span>
            <time>{new Date(item.updatedAt).toLocaleString("th-TH")}</time>
          </div>
        </div>
        {unread && (
          <button
            type="button"
            disabled={reading}
            onClick={onRead}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
          >
            {reading ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
            <span className="hidden sm:inline">Read</span>
          </button>
        )}
      </div>
    </article>
  );
}
