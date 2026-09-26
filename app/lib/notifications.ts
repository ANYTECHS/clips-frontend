import { logger } from "@/app/lib/logger";

/**
 * Notification utility for handling browser push notifications
 * with permission persistence to localStorage
 */

const NOTIFICATION_PERMISSION_KEY = "clipcash_notification_permission";

export type NotificationPermissionState = "granted" | "denied" | "default";

type PermissionChangeListener = (permission: NotificationPermissionState) => void;

function isNotificationPermission(value: string | null): value is NotificationPermissionState {
  return value === "granted" || value === "denied" || value === "default";
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get stored notification permission preference
 */
export function getStoredPermission(): NotificationPermissionState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  return isNotificationPermission(stored) ? stored : null;
}

/**
 * Store notification permission preference
 */
export function storePermission(permission: NotificationPermissionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
}

export function getCurrentPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission as NotificationPermissionState;
}

export function syncNotificationPermission(): NotificationPermissionState {
  const current = getCurrentPermission();
  storePermission(current);
  return current;
}

export function getNotificationSettingsUrl(userAgent?: string): string | null {
  const ua =
    userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");

  if (/Edg\//.test(ua)) return "edge://settings/content/notifications";
  if (/Chrome\//.test(ua) && !/Chromium|OPR\//.test(ua)) {
    return "chrome://settings/content/notifications";
  }
  if (/Firefox\//.test(ua)) return "about:preferences#privacy";

  return null;
}

export function getNotificationSettingsInstructions(userAgent?: string): string {
  const ua =
    userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");

  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR\//.test(ua)) {
    return "Open Safari Settings, choose Websites, then Notifications, and allow ClipCash.";
  }

  return "Open your browser site settings, find Notifications, and allow ClipCash.";
}

export function watchNotificationPermission(
  onChange: PermissionChangeListener
): () => void {
  if (typeof window === "undefined") return () => {};

  let cancelled = false;
  let permissionStatus: PermissionStatus | null = null;

  const notify = () => {
    onChange(syncNotificationPermission());
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") notify();
  };

  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if ("permissions" in navigator && "query" in navigator.permissions) {
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        permissionStatus = status;
        status.addEventListener("change", notify);
      })
      .catch(() => {});
  }

  return () => {
    cancelled = true;
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    permissionStatus?.removeEventListener("change", notify);
  };
}

/**
 * Request notification permission from the user
 * Returns the permission state
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) {
    return "denied";
  }

  const current = getCurrentPermission();
  if (current === "granted" || current === "denied") {
    storePermission(current);
    return current;
  }

  try {
    const permission = (await Notification.requestPermission()) as NotificationPermissionState;
    storePermission(permission);
    return permission;
  } catch (error) {
    logger.warn("Notification permission request failed:", error);
    return syncNotificationPermission();
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canSendNotification(): boolean {
  if (!isNotificationSupported()) return false;

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
    logger.info("Service Worker registered:", registration);
    return registration;
  } catch (error) {
    logger.error("Service Worker registration failed:", error);
    return null;
  }
}
