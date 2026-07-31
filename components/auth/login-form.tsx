"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { api } from "@/lib/api";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username")),
          password: String(form.get("password")),
        }),
        signal: AbortSignal.timeout(75_000),
      });
      if (!response.ok) {
        setError("Invalid username or password.");
        return;
      }
      const session = await response.json() as { access_token: string; refresh_token: string };
      const { error: sessionError } = await createClient().auth.setSession(session);
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      api.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
      router.replace(safeInternalPath(nextPath));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      console.error("Login request failed", { apiUrl, message });
      if (error instanceof DOMException && error.name === "TimeoutError") {
        setError("The inventory service took too long to respond. Please try again.");
        return;
      }
      setError(`The inventory service is unavailable. API: ${apiUrl}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">Username
        <input name="username" type="text" autoComplete="username" required placeholder="admin" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Password
        <input name="password" type="password" autoComplete="current-password" required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" />
      </label>
      <p className="text-right text-xs"><Link href="/forgot-password" className="font-medium text-cyan-700 hover:text-cyan-600">Request password reset</Link></p>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />} Sign in
      </button>
    </form>
  );
}
