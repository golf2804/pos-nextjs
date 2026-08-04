"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/client";
import { clearManagedAccessToken } from "@/lib/api";

export function UserProfileMenu() {
  const router = useRouter();
  const me = useCurrentUser();
  const name = me.data?.fullName ?? (me.isLoading ? "Loading..." : "Session unavailable");
  const username = me.data?.username ?? (me.isLoading ? "loading" : "profile-error");
  const role = me.data?.role ?? (me.isLoading ? "Loading" : "Unknown");
  const initials = me.data?.fullName
    ? me.data.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    : me.isLoading ? "..." : "!";

  async function logout() {
    clearManagedAccessToken();
    try {
      await Promise.race([
        createClient().auth.signOut(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Sign out timed out.")), 5_000)),
      ]);
    } catch {
      // Local token cleanup above is enough to prevent further API requests.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="flex size-7 items-center justify-center rounded-md bg-cyan-700 text-xs text-white">{initials}</span>
        <span className="hidden max-w-28 truncate sm:inline">{name}</span>
        <ChevronDown className="size-4 text-slate-400" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{name}</p>
          <p className="truncate text-xs text-slate-500">@{username}</p>
          <p className="mt-1 text-xs font-medium text-cyan-700">{role}</p>
          {me.isError && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Unable to load account profile.</p>}
        </div>
        {me.data?.role === "ADMIN" && (
          <button onClick={() => router.push("/users")} className="mt-2 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><UserRound className="size-4" /> Users</button>
        )}
        <button onClick={logout} className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"><LogOut className="size-4" /> Sign out</button>
      </div>
    </details>
  );
}
