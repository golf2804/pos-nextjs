import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell title="Sign in" description="Use your username to access inventory operations.">
      <LoginForm nextPath={next} />
    </AuthShell>
  );
}
