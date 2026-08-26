export type NotificationType =
  | "job_complete"
  | "transform_complete"
  | "mint_success"
  | "earnings_received";

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

class NotificationStore {
  private notifications: Map<string, NotificationItem> = new Map();

  constructor() {
    // Seed initial demo notifications
    const defaultUserId = "default_user";
    const initial: NotificationItem[] = [
      {
        id: "notif_1",
        userId: defaultUserId,
        type: "job_complete",
        title: "Your clips are ready!",
        message: "Found 5 viral moments from your uploaded video",
        payload: { jobId: "job_123" },
        readAt: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
      {
        id: "notif_2",
        userId: defaultUserId,
        type: "transform_complete",
        title: "Style Transformation Complete",
        message: "Anime style transformation finished for clip #2",
        payload: { clipId: "clip_456", style: "anime" },
        readAt: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ];

    for (const item of initial) {
      this.notifications.set(item.id, item);
    }
  }

  async getUnread(userId: string): Promise<NotificationItem[]> {
    return Array.from(this.notifications.values())
      .filter((item) => (item.userId === userId || userId === "all" || item.userId === "default_user") && !item.readAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAll(userId: string): Promise<NotificationItem[]> {
    return Array.from(this.notifications.values())
      .filter((item) => item.userId === userId || userId === "all" || item.userId === "default_user")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markAsRead(id: string): Promise<NotificationItem | null> {
    const item = this.notifications.get(id);
    if (!item) return null;
    const updated = { ...item, readAt: new Date().toISOString() };
    this.notifications.set(id, updated);
    return updated;
  }

  async add(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    payload?: Record<string, unknown>
  ): Promise<NotificationItem> {
    const id = `notif_${Math.random().toString(36).substring(2, 9)}`;
    const newItem: NotificationItem = {
      id,
      userId,
      type,
      title,
      message,
      payload: payload ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.set(id, newItem);
    return newItem;
  }
}

export const notificationStore = new NotificationStore();
