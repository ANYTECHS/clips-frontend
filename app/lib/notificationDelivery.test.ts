import { sendTransactionalEmail } from "@/app/api/earnings/shared/mailer";
import { prisma } from "@/app/lib/prisma";
import webPush from "web-push";
import { sendNotification } from "./notificationDelivery";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
    pushSubscription: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}));
jest.mock("@/app/api/earnings/shared/mailer", () => ({
  sendTransactionalEmail: jest.fn(),
}));
jest.mock("web-push", () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() },
}));

const userFindUnique = prisma.user.findUnique as jest.Mock;
const notificationCreate = prisma.notification.create as jest.Mock;
const subscriptionFindMany = prisma.pushSubscription.findMany as jest.Mock;
const emailSend = sendTransactionalEmail as jest.Mock;
const pushSend = webPush.sendNotification as jest.Mock;

const notificationRow = {
  id: "notification-1",
  userId: "user-1",
  type: "job_complete",
  title: "Your clips are ready!",
  message: "Found 3 viral moments from your video.",
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
  process.env.VAPID_SUBJECT = "mailto:push@example.com";
  userFindUnique.mockResolvedValue({
    email: "creator@example.com",
    notificationPreferences: {
      job_complete: { inApp: true, email: true, push: true },
    },
  });
  notificationCreate.mockResolvedValue(notificationRow);
  subscriptionFindMany.mockResolvedValue([
    {
      endpoint: "https://fcm.googleapis.com/push/1",
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
  ]);
  emailSend.mockResolvedValue({ ok: true });
  pushSend.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

describe("sendNotification", () => {
  it("persists in-app and delivers to enabled email and push channels", async () => {
    const result = await sendNotification("user-1", "job_complete", { momentsFound: 3 });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "job_complete",
        title: "Your clips are ready!",
        message: "Found 3 viral moments from your video.",
        payload: { momentsFound: 3 },
      }),
    });
    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "creator@example.com", subject: expect.any(String) }),
    );
    expect(pushSend).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/push/1" }),
      expect.stringContaining("Found 3 viral moments"),
    );
    expect(result.notification).toBe(notificationRow);
    expect(result.delivered).toEqual(["inApp", "email", "push"]);
  });

  it("filters channels disabled in the user's per-type preferences", async () => {
    userFindUnique.mockResolvedValue({
      email: "creator@example.com",
      notificationPreferences: {
        job_complete: { inApp: true, email: false, push: false },
      },
    });

    const result = await sendNotification("user-1", "job_complete", {});

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(emailSend).not.toHaveBeenCalled();
    expect(subscriptionFindMany).not.toHaveBeenCalled();
    expect(result.delivered).toEqual(["inApp"]);
  });

  it("does not dispatch channels omitted from the caller's channel filter", async () => {
    const result = await sendNotification("user-1", "job_complete", {}, ["email"]);

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(subscriptionFindMany).not.toHaveBeenCalled();
    expect(result.delivered).toEqual(["inApp", "email"]);
  });
});
