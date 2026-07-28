import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/auth/permissions";
export { canAccessAppRoute, canManageInventory, type UserRole } from "@/lib/auth/permissions";

export type CurrentUser = {
  id?: string;
  fullName: string;
  username: string;
  role: UserRole;
};

async function getCurrentUser() {
  const { data } = await api.get<CurrentUser>("/auth/me");
  return data;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
