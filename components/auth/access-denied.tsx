"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <section className="w-full max-w-lg text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <ShieldX className="size-7" />
        </span>
        <p className="mt-5 text-sm font-semibold uppercase text-rose-700 dark:text-rose-300">Error 403</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">Access denied</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          Your account does not have permission to open this page. Contact an administrator if you need access.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            onClick={() => window.history.back()}
            variant="outline"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button asChild><Link href="/"><LayoutDashboard className="size-4" /> Dashboard</Link></Button>
        </div>
      </section>
    </main>
  );
}
