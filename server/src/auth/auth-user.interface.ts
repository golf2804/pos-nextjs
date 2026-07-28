import type { AppRole } from "./roles.enum.js";

export interface AuthUser {
  id: string;
  authUserId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: AppRole;
}
