export type UserRole = "ADMIN" | "MANAGER" | "STAFF";

export function canManageInventory(role?: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessAppRoute(pathname: string, role?: UserRole) {
  if (!role) return false;
  if (pathname === "/users" || pathname.startsWith("/users/")) return role === "ADMIN";
  if (pathname === "/reports" || pathname.startsWith("/reports/")) return canManageInventory(role);
  return true;
}
