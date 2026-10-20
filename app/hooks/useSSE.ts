"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { NotificationItem } from "@/app/api/notifications/notificationStore";

export interface UseSSEOptions {
  url?: string;
  userId?: string;
  enabled?: boolean;
  onNotification?: (notification: NotificationItem) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    url = "/api/notifications/sse",
    userId = "default_user",
    enabled = true,
    onNotification,
  } = options;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const fullUrl = `${url}?userId=${encodeURIComponent(userId)}`;
    const es = new EventSource(fullUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onerror = (e) => {
      setIsConnected(false);
      setError(new Error("SSE connection error"));
    };

    es.addEventListener("connected", () => {
      setIsConnected(true);
    });

    es.addEventListener("notifications", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      } catch {}
    });

    es.addEventListener("notification", (e) => {
      try {
        const item: NotificationItem = JSON.parse(e.data);
        setNotifications((prev) => [item, ...prev]);
        onNotification?.(item);
      } catch {}
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [url, userId, enabled, onNotification]);

  return {
    notifications,
    isConnected,
    error,
    clear,
  };
}
