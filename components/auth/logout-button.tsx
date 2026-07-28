"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} title="Sign out" className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
      <LogOut className="size-4" />
    </button>
  );
}
