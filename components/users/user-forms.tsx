"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/errors";
import {
  resetUserPassword,
  type UserInput,
  type UserProfile,
} from "@/lib/users";

const baseUserSchema = z.object({
  username: z.string().trim()
    .min(3, "Username must contain at least 3 characters.")
    .max(40, "Username must not exceed 40 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens."),
  fullName: z.string().trim().min(2, "Full name must contain at least 2 characters.").max(160, "Full name must not exceed 160 characters."),
  roleCode: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  password: z.string().max(128, "Password must not exceed 128 characters."),
  status: z.enum(["ACTIVE", "DISABLED"]),
});
type UserFormValues = z.infer<typeof baseUserSchema>;

export function UserEditorForm({
  editing,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  editing: UserProfile | null;
  pending: boolean;
  error: string;
  onSubmit: (input: UserInput) => void;
  onCancel: () => void;
}) {
  const schema = useMemo(() => baseUserSchema.superRefine((values, context) => {
    if (!editing && values.password.length < 8) {
      context.addIssue({ code: "custom", path: ["password"], message: "Password must contain at least 8 characters." });
    }
  }), [editing]);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing ? {
      username: editing.username,
      fullName: editing.fullName,
      roleCode: editing.role,
      password: "",
      status: editing.status,
    } : {
      username: "",
      fullName: "",
      roleCode: "STAFF",
      password: "",
      status: "ACTIVE",
    },
    mode: "onBlur",
  });
  const submit = form.handleSubmit((values) => onSubmit({
    username: values.username.trim().toLowerCase(),
    fullName: values.fullName.trim(),
    roleCode: values.roleCode,
    status: values.status,
    password: editing ? undefined : values.password,
  }));

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{editing ? "Update User" : "Create User"}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">System-managed accounts only</p>
        </div>
        {editing && <Button type="button" variant="outline" size="icon" onClick={onCancel} title="Cancel"><X /></Button>}
      </div>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field label="Username" error={form.formState.errors.username?.message}><Input autoComplete="off" {...form.register("username")} aria-invalid={Boolean(form.formState.errors.username)} /></Field>
        <Field label="Full Name" error={form.formState.errors.fullName?.message}><Input {...form.register("fullName")} aria-invalid={Boolean(form.formState.errors.fullName)} /></Field>
        <Field label="Role"><select {...form.register("roleCode")} className="input"><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option></select></Field>
        {editing ? (
          <Field label="Status"><select {...form.register("status")} className="input"><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></Field>
        ) : (
          <Field label="Initial Password" error={form.formState.errors.password?.message}><Input type="password" autoComplete="new-password" {...form.register("password")} aria-invalid={Boolean(form.formState.errors.password)} /></Field>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        <Button disabled={pending} className="h-11 w-full">{pending ? <LoaderCircle className="animate-spin" /> : <Save />}{editing ? "Save Changes" : "Create User"}</Button>
      </form>
    </article>
  );
}

const credentialSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must contain at least 8 characters.")
    .max(128, "Password must not exceed 128 characters."),
  confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});
type CredentialValues = z.infer<typeof credentialSchema>;

export function CredentialDialog({
  user,
  onClose,
}: {
  user: UserProfile;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState("");
  const form = useForm<CredentialValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onBlur",
  });
  const mutation = useMutation({
    mutationFn: async (values: CredentialValues) => {
      await resetUserPassword(user.id, values.newPassword);
    },
    onSuccess: () => {
      setStatusMessage("Password updated successfully. It cannot be viewed again.");
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => form.setError("root.server", {
      message: getApiErrorMessage(error, "Unable to set the new password."),
    }),
  });

  const serverMessage = (form.formState.errors.root as { server?: { message?: string } } | undefined)?.server?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="credential-title" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="credential-title" className="text-lg font-semibold">Set New Password</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.fullName} (@{user.username})</p></div>
          <Button type="button" variant="outline" size="icon" onClick={onClose} title="Close"><X /></Button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <Field label="New Password" error={form.formState.errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...form.register("newPassword")} aria-invalid={Boolean(form.formState.errors.newPassword)} /></Field>
          <Field label="Confirm Password" error={form.formState.errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} aria-invalid={Boolean(form.formState.errors.confirmPassword)} /></Field>
          {(serverMessage || statusMessage) && <p role={serverMessage ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${serverMessage ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{serverMessage || statusMessage}</p>}
          <Button disabled={mutation.isPending} className="h-11 w-full">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}Set New Password</Button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{error && <span role="alert" className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">{error}</span>}</label>;
}
