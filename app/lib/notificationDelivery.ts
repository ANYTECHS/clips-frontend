import webPush from "web-push";
import { sendTransactionalEmail } from "@/app/api/earnings/shared/mailer";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import type { NotificationType } from "@/app/api/notifications/notificationStore";
import type { Prisma } from "@prisma/client";

export type NotificationChannel = "inApp" | "email" | "push";
export type NotificationPreferences = Partial<
  Record<NotificationType, Partial<Record<NotificationChannel, boolean>>>
>;

interface NotificationPayload {
  [key: string]: unknown;
}

interface NotificationTemplate {
  title: string;
  subject: string;
  message(payload: NotificationPayload): string;
}

const templates: Record<NotificationType, NotificationTemplate> = {
  job_complete: {
    title: "Your clips are ready!",
    subject: "Your ClipCash clips are ready",
    message: (payload) => {
      const moments = readValue(payload, "momentsFound") ?? "new";
      return `Found ${moments} viral moment${moments === "1" ? "" : "s"} from your video.`;
    },
  },
  transform_complete: {
    title: "Style transformation complete",
    subject: "Your ClipCash transformation is complete",
    message: (payload) => `Your ${readValue(payload, "style") ?? "style"} transformation is ready.`,
  },
  mint_success: {
    title: "NFT mint complete",
    subject: "Your ClipCash NFT was minted",
    message: (payload) => `Your NFT was minted${readValue(payload, "txHash") ? ` (transaction ${readValue(payload, "txHash")})` : ""}.`,
  },
  earnings_received: {
    title: "Earnings received",
    subject: "You received ClipCash earnings",
    message: (payload) => `You received ${readValue(payload, "amount") ?? "new"} in earnings.`,
  },
};

function readValue(payload: NotificationPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function resolveChannels(
  preferences: NotificationPreferences | null,
  type: NotificationType,
  requestedChannels?: NotificationChannel[],
): Set<NotificationChannel> {
  const configured = preferences?.[type] ?? {};
  const requested = requestedChannels ? new Set(requestedChannels) : null;
  const enabled: NotificationChannel[] = [];
  if (configured.inApp !== false) enabled.push("inApp");
  if (configured.email === true) enabled.push("email");
  if (configured.push === true) enabled.push("push");
  return new Set(requested ? enabled.filter((channel) => requested.has(channel)) : enabled);
}

function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export interface SendNotificationResult {
  notification: Awaited<ReturnType<typeof prisma.notification.create>>;
  delivered: NotificationChannel[];
  failed: Partial<Record<Exclude<NotificationChannel, "inApp">, string>>;
}

/** Persists an in-app notification, then delivers it through enabled channels. */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  channels?: NotificationChannel[],
): Promise<SendNotificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreferences: true },
  });
  if (!user) throw new Error("Notification recipient not found");

  const template = templates[type];
  const message = template.message(payload);
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title: template.title,
      message,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  const enabled = resolveChannels(
    user.notificationPreferences as NotificationPreferences | null,
    type,
    channels,
  );
  const delivered: NotificationChannel[] = ["inApp"];
  const failed: SendNotificationResult["failed"] = {};

  if (enabled.has("email")) {
    const result = await sendTransactionalEmail({
      to: user.email,
      subject: template.subject,
      text: message,
      html: `<h1>${escapeHtml(template.title)}</h1><p>${escapeHtml(message)}</p>`,
    });
    if (result.ok) delivered.push("email");
    else {
      failed.email = result.error;
      logger.warn("Notification email delivery failed", { userId, type, error: result.error });
    }
  }

  if (enabled.has("push")) {
    if (!configureVapid()) {
      failed.push = "Web Push VAPID keys are not configured";
    } else {
      const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
      const outcomes = await Promise.allSettled(
        subscriptions.map((subscription) =>
          webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({ title: template.title, body: message, data: payload }),
          ),
        ),
      );
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
      if (rejected.length > 0) {
        failed.push = `${rejected.length} of ${subscriptions.length} push delivery(s) failed`;
        for (const outcome of rejected) {
          const error = outcome.reason as { statusCode?: number; message?: string };
          if (error.statusCode === 404 || error.statusCode === 410) {
            const endpoint = subscriptions[outcomes.indexOf(outcome)]?.endpoint;
            if (endpoint) {
              await prisma.pushSubscription.deleteMany({ where: { endpoint } });
            }
          }
        }
        logger.warn("Notification push delivery failed", { userId, type, error: failed.push });
      } else if (subscriptions.length > 0) {
        delivered.push("push");
      }
    }
  }

  return { notification, delivered, failed };
}
