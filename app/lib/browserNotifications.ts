import { logger } from "@/app/lib/logger";

const NOTIFICATION_PERMISSION_KEY = "clipcash_notification_permission";

export type NotificationPermissionState = "granted" | "denied" | "default";
type PermissionChangeListener = (permission: NotificationPermissionState) => void;

function isNotificationPermission(value: string | null): value is NotificationPermissionState {
  return value === "granted" || value === "denied" || value === "default";
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getStoredPermission(): NotificationPermissionState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  return isNotificationPermission(stored) ? stored : null;
}

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
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/Edg\//.test(ua)) return "edge://settings/content/notifications";
  if (/Chrome\//.test(ua) && !/Chromium|OPR\//.test(ua)) {
    return "chrome://settings/content/notifications";
  }
  if (/Firefox\//.test(ua)) return "about:preferences#privacy";
  return null;
}

export function getNotificationSettingsInstructions(userAgent?: string): string {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR\//.test(ua)) {
    return "Open Safari Settings, choose Websites, then Notifications, and allow ClipCash.";
  }
  return "Open your browser site settings, find Notifications, and allow ClipCash.";
}

export function watchNotificationPermission(
  onChange: PermissionChangeListener,
): () => void {
  if (typeof window === "undefined") return () => {};
  let cancelled = false;
  let permissionStatus: PermissionStatus | null = null;
  const notify = () => onChange(syncNotificationPermission());
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

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return "denied";
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

export function canSendNotification(): boolean {
  if (!isNotificationSupported()) return false;
  if (getStoredPermission() === "denied") return false;
  return Notification.permission === "granted";
}

export function sendNotification(
  title: string,
  options?: NotificationOptions & { onClickPath?: string },
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

export function notifyClipsReady(momentsFound: number, onClickPath = "/projects") {
  return sendNotification("Your clips are ready!", {
    body: `Found ${momentsFound} viral moment${momentsFound !== 1 ? "s" : ""} from your video`,
    tag: "processing-complete",
    onClickPath,
  });
}

export async function registerNotificationServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    logger.info("Service Worker registered:", registration);
    return registration;
  } catch (error) {
    logger.error("Service Worker registration failed:", error);
    return null;
  }
}

function decodeVapidKey(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("PushManager" in window)) return null;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push notifications are not configured");
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;
  const registration = await registerNotificationServiceWorker();
  if (!registration) return null;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(publicKey),
  });
  const response = await fetch("/api/notifications/register-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Failed to register push subscription");
  return subscription;
}
