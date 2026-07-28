"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, Pencil, ShieldOff, Users } from "lucide-react";
import { AccessDenied } from "@/components/auth/access-denied";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { CredentialDialog, UserEditorForm } from "@/components/users/user-forms";
import { useCurrentUser } from "@/lib/auth/current-user";
import { getApiErrorMessage } from "@/lib/errors";
import {
  createUser,
  deleteUser,
  getUsers,
  type UserInput,
  type UserProfile,
  updateUser,
} from "@/lib/users";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [credentialDialog, setCredentialDialog] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formResetSignal, setFormResetSignal] = useState(0);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: me.data?.role === "ADMIN",
  });
  const saveMutation = useMutation({
    mutationFn: (input: UserInput) =>
      editing ? updateUser(editing.id, input) : createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
      setFormResetSignal((value) => value + 1);
      setError("");
      setNotice("User saved successfully.");
    },
    onError: (mutationError) => {
      setNotice("");
      setError(getApiErrorMessage(mutationError, "Unable to save user."));
    },
  });
  const removeMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setNotice("User disabled.");
      setError("");
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError, "Unable to disable user.")),
  });

  if (me.isLoading) {
    return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center"><LoaderCircle className="size-6 animate-spin text-cyan-700" /></div>;
  }
  if (me.data?.role !== "ADMIN") return <AccessDenied />;

  return (
    <main className="min-h-full bg-stone-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"><Users className="size-5" /></span>
          <div><h1 className="text-xl font-semibold">User Management</h1><p className="text-sm text-slate-500 dark:text-slate-400">Create system-managed accounts and assign access roles</p></div>
        </div>
        {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <UserEditorForm
            key={editing?.id ?? `new-${formResetSignal}`}
            editing={editing}
            pending={saveMutation.isPending}
            error={error}
            onSubmit={(input) => {
              setError("");
              setNotice("");
              saveMutation.mutate(input);
            }}
            onCancel={() => {
              setEditing(null);
              setError("");
            }}
          />

          <article className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold">Users</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{users.data?.users.length ?? 0} managed accounts</p>
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Users table">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Password</th>
                    <th className="px-4 py-3 font-semibold">Last Login</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.data?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-4 font-medium">{user.fullName}<p className="font-mono text-xs text-slate-500">@{user.username}</p></td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{user.role}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{user.status}</span></td>
                      <td className="px-4 py-4">
                        <p className={user.passwordConfigured ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{user.passwordConfigured ? "Configured" : "Not configured"}</p>
                        <p className="text-xs text-slate-400">{user.passwordUpdatedAt ? `Changed ${new Date(user.passwordUpdatedAt).toLocaleString("th-TH")}` : "No change recorded"}</p>
                        {user.passwordResetRequestedAt && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Reset requested {new Date(user.passwordResetRequestedAt).toLocaleString("th-TH")}</p>}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("th-TH") : "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setEditing(user); setError(""); setNotice(""); }} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700" title="Edit user"><Pencil className="size-4" /></button>
                          <button type="button" onClick={() => setCredentialDialog(user)} className="flex size-9 items-center justify-center rounded-lg border border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300" title="Set new password"><KeyRound className="size-4" /></button>
                          <ConfirmAction title="Disable user?" description={`"${user.fullName}" (@${user.username}) will no longer be able to sign in. Their audit history is preserved.`} confirmLabel="Disable user" onConfirm={() => removeMutation.mutate(user.id)}>
                            <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300" title="Disable user"><ShieldOff className="size-4" /></button>
                          </ConfirmAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading users...</p>}
              {users.isError && <p className="py-12 text-center text-sm text-rose-600">{getApiErrorMessage(users.error, "Unable to load users.")}</p>}
            </div>
          </article>
        </div>
      </div>

      {credentialDialog && (
        <CredentialDialog
          user={credentialDialog}
          onClose={() => setCredentialDialog(null)}
        />
      )}
    </main>
  );
}
