import { describe, expect, it } from "@jest/globals";

import {
  API_CONTRACT_VERSION,
  validateExternalApiEnvelope,
} from "@/app/lib/externalApiContracts";

describe("external API contract", () => {
  it("accepts a valid payload for the current contract version", () => {
    const payload = {
      version: API_CONTRACT_VERSION,
      ok: true,
      data: {
        id: "wallet-123",
        status: "ok",
        message: "Wallet ready",
      },
    };

    expect(validateExternalApiEnvelope(payload)).toEqual(payload);
  });

  it("rejects a payload with an incompatible contract version", () => {
    expect(() =>
      validateExternalApiEnvelope({
        version: "2025-01-01",
        ok: true,
        data: { id: "wallet-123", status: "ok" },
      })
    ).toThrow(/does not match the/);
  });

  it("rejects a payload with an invalid status value", () => {
    expect(() =>
      validateExternalApiEnvelope({
        version: API_CONTRACT_VERSION,
        ok: false,
        data: { id: "wallet-123", status: "invalid-status" },
      })
    ).toThrow(/does not match the/);
  });
});
