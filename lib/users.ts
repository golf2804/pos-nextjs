import { api } from "@/lib/api";

export type UserRole = "ADMIN" | "MANAGER" | "STAFF";
export type UserStatus = "ACTIVE" | "DISABLED";
export type UserProfile = { id: string; username: string; fullName: string; status: UserStatus; role: UserRole; passwordConfigured: boolean; passwordUpdatedAt: string | null; passwordResetRequestedAt: string | null; lastLoginAt: string | null; createdAt: string; updatedAt: string };
export type UserInput = { username: string; fullName: string; roleCode: UserRole; password?: string; status?: UserStatus };

export async function getUsers() { const { data } = await api.get<{ users: UserProfile[]; roles: { id: number; code: UserRole; name: string }[] }>("/users"); return data; }
export async function createUser(input: UserInput) { const { data } = await api.post<UserProfile>("/users", input); return data; }
export async function updateUser(id: string, input: Partial<UserInput>) { const { data } = await api.patch<UserProfile>(`/users/${id}`, input); return data; }
export async function deleteUser(id: string) { const { data } = await api.delete<UserProfile>(`/users/${id}`); return data; }
export async function resetUserPassword(id: string, password: string) { const { data } = await api.post<{ success: true; passwordUpdatedAt: string }>(`/users/${id}/reset-password`, { password }); return data; }
