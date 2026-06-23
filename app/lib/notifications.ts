"use client";

/**
 * Notification utility for handling browser push notifications
 * with permission persistence to localStorage
 */

const NOTIFICATION_PERMISSION_KEY = "clipcash_notification_permission";

export type NotificationPermissionState = "granted" | "denied" | "default";

/**
 * Get stored notification permission preference
 */
export function getStoredPermission(): NotificationPermissionState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  return stored as NotificationPermissionState | null;
}

/**
 * Store notification permission preference
 */
export function storePermission(permission: NotificationPermissionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
}

/**
 * Request notification permission from the user
 * Returns the permission state
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // Check if permission already stored and still valid
  const stored = getStoredPermission();
  if (stored && stored === Notification.permission) {
    return stored;
  }

  const permission = await Notification.requestPermission();
  storePermission(permission as NotificationPermissionState);
  return permission as NotificationPermissionState;
}

/**
 * Check if notifications are supported and permitted
 */
export function canSendNotification(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;

  // Check stored preference first
  const stored = getStoredPermission();
  if (stored === "denied") return false;

  return Notification.permission === "granted";
}

/**
 * Send a browser notification
 */
export function sendNotification(
  title: string,
  options?: NotificationOptions & { onClickPath?: string }
): Notification | null {
  if (!canSendNotification()) return null;

  const notification = new Notification(title, {
    icon: "/avatar.png",
    badge: "/avatar.png",
    ...options,
  });

  if (options?.onClickPath) {
    notification.onclick = () => {
      window.focus();
      window.location.href = options.onClickPath!;
    };
  }

  return notification;
}

/**
 * Notify user that clips are ready
 */
export function notifyClipsReady(momentsFound: number, onClickPath: string = "/projects") {
  return sendNotification("Your clips are ready!", {
    body: `Found ${momentsFound} viral moment${momentsFound !== 1 ? "s" : ""} from your video`,
    tag: "processing-complete",
    onClickPath,
  });
}

/**
 * Register service worker for push notifications (when tab is closed)
 */
export async function registerNotificationServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker registered:", registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}
