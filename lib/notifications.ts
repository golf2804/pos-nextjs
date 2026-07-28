import { api } from "@/lib/api";

export type NotificationType = "LOW_STOCK" | "OUT_OF_STOCK";
export type NotificationStatus = "active" | "unread" | "read" | "resolved" | "all";
export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  sourceKey: string;
  userId: string;
  productId: string;
  product: { id: string; sku: string; name: string; unit: string };
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type NotificationParams = {
  type?: NotificationType;
  status?: NotificationStatus;
  page?: number;
  limit?: number;
};
export type NotificationsResponse = {
  unreadCount: number;
  items: NotificationItem[];
  meta: { page: number; limit: number; total: number; pageCount: number };
};

export async function getNotifications(params: NotificationParams = {}) {
  const { data } = await api.get<NotificationsResponse>("/notifications", { params });
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.patch<NotificationItem>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post<NotificationsResponse>("/notifications/read-all");
  return data;
}
