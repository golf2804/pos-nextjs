import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Request password reset"
      description="Submit your username. An administrator will verify the request and provide a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
