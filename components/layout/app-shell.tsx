"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

function Navigation({ pathname, role, onNavigate }: { pathname: string; role?: UserRole; onNavigate?: () => void }) {
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
            className={`group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all ${
              active
                ? "bg-slate-950 text-white shadow-sm shadow-slate-950/10 dark:bg-cyan-600 dark:shadow-cyan-950/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            }`}
          >
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
  const me = useCurrentUser();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileOpen = mobileMenuPath === pathname;

  if (shellFreeRoutes.some((route) => pathname.startsWith(route))) {
    return children;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 lg:block">
          <Brand />
          <Navigation pathname={pathname} role={me.data?.role} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-slate-950/45"
              onClick={() => setMobileMenuPath(null)}
              aria-label="Close navigation"
            />
            <aside className="relative h-full w-72 border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <Brand close={() => setMobileMenuPath(null)} />
              <Navigation pathname={pathname} role={me.data?.role} onNavigate={() => setMobileMenuPath(null)} />
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm shadow-slate-950/20 dark:bg-cyan-600 dark:shadow-cyan-950/20">
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
