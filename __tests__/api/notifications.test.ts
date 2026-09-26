import { GET } from "@/app/api/notifications/route";
import { PATCH } from "@/app/api/notifications/[id]/read/route";
import { NextRequest } from "next/server";

describe("Notifications API Routes", () => {
  it("GET /api/notifications returns unread notification items", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.unreadCount).toBe("number");
  });

  it("PATCH /api/notifications/:id/read marks notification as read", async () => {
    const getReq = new NextRequest("http://localhost:3000/api/notifications");
    const getRes = await GET(getReq);
    const getJson = await getRes.json();
    const notificationId = getJson.data[0]?.id;

    if (notificationId) {
      const patchReq = new NextRequest(`http://localhost:3000/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: notificationId }) });
      expect(patchRes.status).toBe(200);

      const patchJson = await patchRes.json();
      expect(patchJson.success).toBe(true);
      expect(patchJson.data.readAt).not.toBeNull();
    }
  });
});
