"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Bell,
  Boxes,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Menu,
  PackageMinus,
  PackagePlus,
  Settings,
  SlidersHorizontal,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationButton } from "@/components/layout/notification-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { canAccessAppRoute, useCurrentUser, type UserRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/client";
import { clearManagedAccessToken } from "@/lib/api";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Products", icon: Boxes, href: "/products" },
  { label: "Categories", icon: ClipboardList, href: "/categories" },
  { label: "Suppliers", icon: Truck, href: "/suppliers" },
  { label: "Stock In", icon: PackagePlus, href: "/stock-in" },
  { label: "Stock Out", icon: PackageMinus, href: "/stock-out" },
  { label: "Operations", icon: SlidersHorizontal, href: "/inventory-operations" },
  { label: "Transactions", icon: FileBarChart, href: "/transactions" },
  { label: "Reports", icon: FileBarChart, href: "/reports" },
  { label: "Users", icon: Users, href: "/users" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
] as const;

const shellFreeRoutes = ["/login", "/forgot-password", "/reset-password", "/auth"];

function Navigation({
  pathname,
  role,
  loading,
  failed,
  onRetry,
  onNavigate,
}: {
  pathname: string;
  role?: UserRole;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onNavigate?: () => void;
}) {
  if (loading) {
    return (
      <nav className="space-y-2 px-3 py-5" aria-label="Loading navigation">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
        ))}
      </nav>
    );
  }

  if (failed) {
    return (
      <nav className="px-3 py-5" aria-label="Navigation unavailable">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Session profile unavailable</p>
          <p className="mt-1 text-xs leading-5">Refresh your session to load role-based navigation.</p>
          <button type="button" onClick={onRetry} className="mt-3 h-9 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-600">
            Retry
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="space-y-1.5 px-3 py-5">
      {navigation.filter((item) => canAccessAppRoute(item.href, role)).map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all ${
              active
                ? "bg-slate-950 text-white shadow-sm shadow-slate-950/10 dark:bg-cyan-600 dark:shadow-cyan-950/20"
                : "text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            }`}
          >
            {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-cyan-300 dark:bg-white" />}
            <Icon className={`size-4 shrink-0 ${active ? "text-cyan-200 dark:text-white" : "text-slate-400 group-hover:text-cyan-700 dark:text-slate-500 dark:group-hover:text-cyan-300"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        disabled
        title="Settings is not available yet"
        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 opacity-70"
      >
        <Settings className="size-4 shrink-0" />
        <span>Settings</span>
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useCurrentUser();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileOpen = mobileMenuPath === pathname;
  const authStatus = axios.isAxiosError(me.error) ? me.error.response?.status : undefined;
  const sessionInvalid = authStatus === 401 || authStatus === 403;
  const loginPath = useMemo(() => {
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return `/login${next}`;
  }, [pathname]);

  useEffect(() => {
    if (!sessionInvalid) return;
    let active = true;
    clearManagedAccessToken();
    void createClient().auth.signOut().finally(() => {
      if (!active) return;
      router.replace(loginPath);
      router.refresh();
    });
    return () => { active = false; };
  }, [loginPath, router, sessionInvalid]);

  if (shellFreeRoutes.some((route) => pathname.startsWith(route))) {
    return children;
  }

  if (sessionInvalid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          Redirecting to sign in...
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 lg:block">
          <Brand />
          <Navigation pathname={pathname} role={me.data?.role} loading={me.isLoading} failed={me.isError} onRetry={() => void me.refetch()} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-slate-950/45"
              onClick={() => setMobileMenuPath(null)}
              aria-label="Close navigation"
            />
            <aside className="relative h-full w-72 animate-menu-sheet border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <Brand close={() => setMobileMenuPath(null)} />
              <Navigation pathname={pathname} role={me.data?.role} loading={me.isLoading} failed={me.isError} onRetry={() => void me.refetch()} onNavigate={() => setMobileMenuPath(null)} />
            </aside>
          </div>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 md:px-6">
            <button
              type="button"
              onClick={() => setMobileMenuPath(pathname)}
              className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
              title="Open navigation"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-5" />
            </button>
            <Breadcrumbs pathname={pathname} />
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 md:flex-none">
              <GlobalSearch />
              <NotificationButton />
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </header>

          <div id="main-content" tabIndex={-1} key={pathname} className="app-shell-content min-w-0 flex-1 animate-page-slide">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) {
    return <p className="hidden text-sm font-medium text-slate-800 dark:text-slate-200 md:block">Dashboard</p>;
  }

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
      <Link href="/" className="text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300">Dashboard</Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const label = navigation.find((item) => item.href === href)?.label
          ?? (segment === "forbidden" ? "Access denied" : segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
        const current = index === segments.length - 1;
        return (
          <span key={href} className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-slate-300 dark:text-slate-600">/</span>
            {current
              ? <span aria-current="page" className="truncate font-medium text-slate-800 dark:text-slate-200">{label}</span>
              : <Link href={href} className="truncate text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300">{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

function Brand({ close }: { close?: () => void }) {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
      <Link href="/" onClick={close} className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm shadow-slate-950/20 transition-transform duration-200 hover:scale-105 dark:bg-cyan-600 dark:shadow-cyan-950/20">
          <Warehouse className="size-5" />
        </span>
        <span>
          <span className="block text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">POS</span>
          <span className="block text-lg font-semibold leading-5 text-slate-950 dark:text-white">Inventory</span>
        </span>
      </Link>
      {close && (
        <button
          type="button"
          onClick={close}
          className="ml-auto flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Close navigation"
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}
