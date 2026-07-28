"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const requestSchema = z.object({
  username: z.string().trim()
    .min(3, "Username must contain at least 3 characters.")
    .max(40, "Username must not exceed 40 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username has an invalid format."),
});
type RequestValues = z.infer<typeof requestSchema>;

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { username: "" },
  });
  const submit = form.handleSubmit(async ({ username }) => {
    setMessage("");
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/auth/password-reset-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase() }),
    });
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const responseMessage = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    setMessage(response.ok
      ? responseMessage ?? "The administrator has received your password reset request."
      : responseMessage ?? "Unable to submit the request. Try again later.");
  });

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <label className="block text-sm font-medium text-slate-700">
        Username
        <Input autoComplete="username" className="mt-2" {...form.register("username")} aria-invalid={Boolean(form.formState.errors.username)} />
        {form.formState.errors.username?.message && <span role="alert" className="mt-1.5 block text-xs text-rose-600">{form.formState.errors.username.message}</span>}
      </label>
      <p className="text-sm leading-6 text-slate-500">An administrator will verify the request and issue a new managed password.</p>
      {message && <p role="status" className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-800">{message}</p>}
      <Button disabled={form.formState.isSubmitting} className="h-11 w-full">
        {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
        Request password reset
      </Button>
      <Link href="/login" className="block text-center text-sm font-medium text-cyan-700">Back to sign in</Link>
    </form>
  );
}
