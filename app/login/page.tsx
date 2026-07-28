import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" description="Use your username to access inventory operations.">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-slate-100" />}><LoginForm /></Suspense>
    </AuthShell>
  );
}
