"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password.length < 8 || password !== confirmation) {
      setError(password.length < 8 ? "Password must be at least 8 characters." : "Passwords do not match.");
      setLoading(false);
      return;
    }
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">New password
        <input name="password" type="password" minLength={8} required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Confirm password
        <input name="confirmation" type="password" minLength={8} required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Update password
      </button>
    </form>
  );
}
