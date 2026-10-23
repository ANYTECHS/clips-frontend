import { addWalletBreadcrumb } from "@/app/lib/walletErrorTracking";
import { sanitizeBreadcrumb, sanitizeSentryEvent } from "@/app/lib/sentryRedaction";

const captureException = jest.fn();
const addBreadcrumb = jest.fn();

jest.mock("@sentry/nextjs", () => ({
  captureException,
  captureMessage: jest.fn(),
  addBreadcrumb,
  init: jest.fn(),
}));

describe("Sentry breadcrumb PII redaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(window, {
      Sentry: { captureException, addBreadcrumb },
    });
  });

  it("does not include key material in wallet error breadcrumbs", () => {
    const secretKey = "S".repeat(56);
    const mnemonic = "abandon ".repeat(11) + "about";

    addWalletBreadcrumb("wallet signing failed", "wallet", {
      secretKey,
      mnemonic,
      private_key: "private-key-value",
    });

    expect(addBreadcrumb).toHaveBeenCalled();
    const payload = addBreadcrumb.mock.calls[0][0];
    expect(payload.data.secretKey).toBe("[REDACTED]");
    expect(payload.data.mnemonic).toBe("[REDACTED]");
    expect(payload.data.private_key).toBe("[REDACTED]");
    expect(payload.data.secretKey).not.toContain(secretKey);
    expect(payload.data.mnemonic).not.toContain("abandon");
  });

  it("beforeBreadcrumb-style sanitizer redacts nested wallet fields", () => {
    const sanitized = sanitizeBreadcrumb({
      category: "wallet",
      message: "test",
      data: {
        public_key: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF",
        secret_key: "super-secret",
      },
    });

    expect(sanitized.data?.secret_key).toBe("[REDACTED]");
    expect(sanitized.data?.public_key).toMatch(/\.\.\./);
    expect(sanitized.data?.public_key).not.toBe(
      "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF"
    );
  });
});

describe("sanitizeSentryEvent", () => {
  it("redacts privateKey, secretKey and seed from every event section", () => {
    const event = sanitizeSentryEvent({
      extra: { privateKey: "PK", nested: { seed: "word word" }, list: [{ secretKey: "SK" }] },
      contexts: { wallet: { secretKey: "SK", private_key: "PK" } },
      tags: { seed: "word" },
      request: { data: { secret_key: "SK" } },
      breadcrumbs: [{ message: "sign", data: { privateKey: "PK" } }],
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('"PK"');
    expect(serialized).not.toContain('"SK"');
    expect(serialized).not.toContain("word");
    expect(event.extra?.privateKey).toBe("[REDACTED]");
    expect(event.contexts?.wallet?.secretKey).toBe("[REDACTED]");
    expect(event.breadcrumbs?.[0].data?.privateKey).toBe("[REDACTED]");
  });
});
