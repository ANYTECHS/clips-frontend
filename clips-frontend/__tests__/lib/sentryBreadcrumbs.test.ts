import { addWalletBreadcrumb } from "@/app/lib/walletErrorTracking";
import { sanitizeBreadcrumb } from "@/app/lib/sentryRedaction";

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
