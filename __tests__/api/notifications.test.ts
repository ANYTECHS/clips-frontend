/**
 * @jest-environment node
 */

import { GET, POST } from "@/app/api/notifications/route";
import { PATCH } from "@/app/api/notifications/[id]/read/route";
import { NextRequest } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { prisma } from "@/app/lib/prisma";
import { sendNotification } from "@/app/lib/notifications";

jest.mock("@/app/api/jobs/shared/authGuard", () => ({
  requireAuth: jest.fn(),
}));
jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("@/app/lib/notifications", () => ({
  sendNotification: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.Mock;
const mockNotification = {
  id: "notification-1",
  userId: "user-1",
  type: "job_complete",
  title: "Your clips are ready!",
  readAt: null,
};

describe("Notifications API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: "user-1" });
  });

  it("GET /api/notifications returns paginated in-app items for the session user", async () => {
    (prisma.notification.count as jest.Mock)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([mockNotification]);
    const req = new NextRequest("http://localhost:3000/api/notifications?page=2&pageSize=1");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([mockNotification]);
    expect(json.unreadCount).toBe(2);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, skip: 1, take: 1 }),
    );
  });

  it("POST dispatches a supported type through the notification service", async () => {
    (sendNotification as jest.Mock).mockResolvedValue({ notification: mockNotification, delivered: ["inApp"], failed: {} });
    const req = new NextRequest("http://localhost:3000/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ type: "job_complete", payload: { jobId: "job-1" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sendNotification).toHaveBeenCalledWith("user-1", "job_complete", { jobId: "job-1" });
  });

  it("PATCH marks only a notification belonging to the session user as read", async () => {
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ ...mockNotification, readAt: new Date() });
    const patchReq = new NextRequest("http://localhost:3000/api/notifications/notification-1/read", {
      method: "PATCH",
      headers: { origin: "http://localhost:3000" },
    });
    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: "notification-1" }) });
    expect(patchRes.status).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notification-1", userId: "user-1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
