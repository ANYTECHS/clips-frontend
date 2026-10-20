/**
 * @jest-environment node
 */

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { signWebhookPayload, verifyWebhookSignature } from "@/app/lib/webhooks/signing";
import { validateWebhookUrl, isRestrictedIp } from "@/app/lib/webhooks/ssrf";
import {
  triggerWebhookEvent,
  executeDeliveryAttempt,
  redeliverWebhook,
  RETRY_DELAYS_MS,
  MAX_SCHEDULED_RETRIES,
  type DeliveryClock,
  type DeliveryScheduler,
  type DeliveryFetcher,
} from "@/app/lib/webhooks/delivery";
import { GET as getWebhooks, POST as createWebhook } from "@/app/api/webhooks/route";
import { GET as getWebhook, PATCH as patchWebhook, DELETE as deleteWebhook } from "@/app/api/webhooks/[id]/route";
import { GET as getDeliveries } from "@/app/api/webhooks/[id]/deliveries/route";
import { POST as redeliverRoute } from "@/app/api/webhooks/[id]/deliveries/[deliveryId]/redeliver/route";

describe("Webhook Delivery with Retry and Dead Letter Queue (Issue #1251)", () => {
  const mockUserId = "usr_test_123456";
  const mockEndpointId = "wh_test_abcdef";
  const mockSecret = "whsec_0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: mockUserId, email: "tester@clipcash.ai" },
    });
  });

  describe("HMAC-SHA256 Signing and Verification", () => {
    it("signs payload with timestamped scheme", () => {
      const payload = JSON.stringify({ event: "job_complete", data: { id: 1 } });
      const signed = signWebhookPayload(mockSecret, payload, "1700000000");

      expect(signed.timestamp).toBe("1700000000");
      expect(signed.headerValue).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
    });

    it("verifies valid signature successfully with constant-time check", () => {
      const payload = JSON.stringify({ event: "job_complete", data: { id: 1 } });
      const { headerValue } = signWebhookPayload(mockSecret, payload, "1700000000");

      const check = verifyWebhookSignature(mockSecret, payload, headerValue, 0);
      expect(check.valid).toBe(true);
    });

    it("rejects tampered payload or incorrect secret", () => {
      const payload = JSON.stringify({ event: "job_complete" });
      const { headerValue } = signWebhookPayload(mockSecret, payload, "1700000000");

      const tampered = verifyWebhookSignature(mockSecret, JSON.stringify({ event: "job_failed" }), headerValue, 0);
      expect(tampered.valid).toBe(false);

      const wrongSecret = verifyWebhookSignature("whsec_wrongsecret", payload, headerValue, 0);
      expect(wrongSecret.valid).toBe(false);
    });
  });

  describe("SSRF Protection", () => {
    it("identifies restricted IP ranges accurately", () => {
      expect(isRestrictedIp("127.0.0.1")).toBe(true);
      expect(isRestrictedIp("10.0.0.5")).toBe(true);
      expect(isRestrictedIp("172.16.1.1")).toBe(true);
      expect(isRestrictedIp("192.168.1.100")).toBe(true);
      expect(isRestrictedIp("169.254.169.254")).toBe(true);
      expect(isRestrictedIp("::1")).toBe(true);
      expect(isRestrictedIp("93.184.216.34")).toBe(false); // Public IP
    });

    it("rejects non-https URLs in production", async () => {
      const result = await validateWebhookUrl("http://example.com/webhook", { allowLocalInDev: false });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS is required");
    });

    it("rejects loopback and private destination URLs in production", async () => {
      const result = await validateWebhookUrl("https://127.0.0.1/webhook", { allowLocalInDev: false });
      expect(result.valid).toBe(false);
    });
  });

  describe("Retry Delay Schedule & Dead Letter Queue", () => {
    it("defines the exact required 5 retry intervals", () => {
      expect(RETRY_DELAYS_MS).toEqual([
        60 * 1000,          // Retry 1: 1 min
        5 * 60 * 1000,      // Retry 2: 5 min
        30 * 60 * 1000,     // Retry 3: 30 min
        2 * 60 * 60 * 1000, // Retry 4: 2 hours
        12 * 60 * 60 * 1000 // Retry 5: 12 hours
      ]);
      expect(MAX_SCHEDULED_RETRIES).toBe(5);
    });

    it("progresses through retry schedule and transitions to dead letter queue after retry 5", async () => {
      let virtualTime = 1700000000000;
      const scheduledTasks: { fn: () => Promise<void> | void; delay: number }[] = [];

      const mockClock: DeliveryClock = {
        now: () => virtualTime,
      };

      const mockScheduler: DeliveryScheduler = {
        schedule: (fn, delay) => {
          scheduledTasks.push({ fn, delay });
        },
      };

      const mockFetcher: DeliveryFetcher = {
        fetch: jest.fn().mockRejectedValue(new Error("Remote server unreachable")),
      };

      // Mock prisma calls for delivery attempt cycle
      const mockDeliveryRecord: any = {
        id: "whd_retry_test_1",
        endpointId: mockEndpointId,
        eventType: "job_complete",
        eventId: "evt_123",
        payload: { id: "evt_123", type: "job_complete", data: {} },
        attempt: 1,
        status: "pending",
        isDeadLetter: false,
        endpoint: {
          id: mockEndpointId,
          userId: mockUserId,
          url: "https://example.com/webhook",
          secret: mockSecret,
          active: true,
        },
      };

      jest.spyOn(prisma.webhookDelivery, "findUnique").mockImplementation(async () => {
        return { ...mockDeliveryRecord };
      });

      const updateSpy = jest.spyOn(prisma.webhookDelivery, "update").mockImplementation(async (args) => {
        Object.assign(mockDeliveryRecord, args.data);
        return mockDeliveryRecord;
      });

      // Initial Attempt (Attempt 1) -> fails
      await executeDeliveryAttempt(mockDeliveryRecord.id, {
        clock: mockClock,
        scheduler: mockScheduler,
        fetcher: mockFetcher,
      });

      // After first failure: attempt is scheduled for retry 1 (delay: 1 minute = 60,000ms, attempt number 2)
      expect(mockDeliveryRecord.status).toBe("failed");
      expect(mockDeliveryRecord.attempt).toBe(2);
      expect(mockDeliveryRecord.isDeadLetter).toBe(false);
      expect(scheduledTasks.length).toBe(1);
      expect(scheduledTasks[0].delay).toBe(60 * 1000);

      // Simulate Retries 2 through 5
      for (let retry = 2; retry <= 5; retry++) {
        const expectedDelay = RETRY_DELAYS_MS[retry - 1];
        scheduledTasks.length = 0;
        virtualTime += RETRY_DELAYS_MS[retry - 2];

        await executeDeliveryAttempt(mockDeliveryRecord.id, {
          clock: mockClock,
          scheduler: mockScheduler,
          fetcher: mockFetcher,
        });

        expect(mockDeliveryRecord.status).toBe("failed");
        expect(mockDeliveryRecord.attempt).toBe(retry + 1);
        expect(mockDeliveryRecord.isDeadLetter).toBe(false);
        expect(scheduledTasks[0].delay).toBe(expectedDelay);
      }

      // Sixth attempt (5th scheduled retry failed) -> Retries exhausted!
      scheduledTasks.length = 0;
      virtualTime += RETRY_DELAYS_MS[4];

      await executeDeliveryAttempt(mockDeliveryRecord.id, {
        clock: mockClock,
        scheduler: mockScheduler,
        fetcher: mockFetcher,
      });

      // Must be transitioned into Dead Letter Queue!
      expect(mockDeliveryRecord.status).toBe("dead_letter");
      expect(mockDeliveryRecord.isDeadLetter).toBe(true);
      expect(scheduledTasks.length).toBe(0); // No further retries scheduled
    });
  });

  describe("API Endpoints & Ownership", () => {
    it("POST /api/webhooks validates URL and supported events, generating a secret", async () => {
      jest.spyOn(prisma.webhookEndpoint, "create").mockResolvedValue({
        id: "wh_new_123",
        userId: mockUserId,
        url: "https://example.com/webhook",
        events: ["job_complete"],
        secret: "whsec_generated_secret_string",
        active: true,
        description: "Test webhook",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost/api/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/webhook",
          events: ["job_complete"],
          description: "Test webhook",
        }),
      });

      const res = await createWebhook(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.webhook.secret).toBeDefined();
      expect(json.webhook.url).toBe("https://example.com/webhook");
    });

    it("GET /api/webhooks omits secrets from endpoint list", async () => {
      jest.spyOn(prisma.webhookEndpoint, "findMany").mockResolvedValue([
        {
          id: "wh_1",
          userId: mockUserId,
          url: "https://example.com/webhook",
          events: ["job_complete"],
          active: true,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const req = new NextRequest("http://localhost/api/webhooks");
      const res = await getWebhooks(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.webhooks).toHaveLength(1);
      expect(json.webhooks[0].secret).toBeUndefined(); // Secret must NOT be disclosed
    });

    it("POST /api/webhooks/[id]/deliveries/[deliveryId]/redeliver moves delivery out of dead letter", async () => {
      const mockDeadLetterRecord: any = {
        id: "whd_dead_letter_1",
        endpointId: mockEndpointId,
        eventType: "job_complete",
        eventId: "evt_123",
        status: "dead_letter",
        isDeadLetter: true,
        endpoint: {
          id: mockEndpointId,
          userId: mockUserId,
          url: "https://example.com/webhook",
          secret: mockSecret,
          active: true,
        },
      };

      jest.spyOn(prisma.webhookDelivery, "findFirst").mockResolvedValue(mockDeadLetterRecord);
      jest.spyOn(prisma.webhookDelivery, "findUnique").mockResolvedValue(mockDeadLetterRecord);
      jest.spyOn(prisma.webhookDelivery, "update").mockImplementation(async (args) => {
        Object.assign(mockDeadLetterRecord, args.data);
        return mockDeadLetterRecord;
      });

      const req = new NextRequest(`http://localhost/api/webhooks/${mockEndpointId}/deliveries/whd_dead_letter_1/redeliver`, {
        method: "POST",
      });

      const res = await redeliverRoute(req, {
        params: Promise.resolve({ id: mockEndpointId, deliveryId: "whd_dead_letter_1" }),
      });

      expect(res.status).toBe(200);
      expect(mockDeadLetterRecord.isDeadLetter).toBe(false);
    });
  });
});
