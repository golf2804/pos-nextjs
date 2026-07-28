"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/notifications";

export function NotificationButton() {
  const notifications = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: () => getNotifications({ status: "active", page: 1, limit: 1 }),
    refetchInterval: 30_000,
  });
  const count = notifications.data?.unreadCount ?? 0;
  return (
    <Link href="/notifications" title="Notifications" className="relative flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-cyan-300">
      <Bell className="size-5" />
      {count > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
