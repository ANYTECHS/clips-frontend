import { generateApiJwt, verifyApiJwt, getJwtSecret } from "@/app/lib/jwt";

describe("JWT Utility (Issue #1164)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, API_JWT_SECRET: "test-jwt-secret-key-32-characters-minimum" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("generates and verifies a valid JWT", () => {
    const payload = { sub: "user-123", email: "user@example.com", scopes: ["read", "write"] };
    const token = generateApiJwt(payload, { expiresInSeconds: 60 });

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const result = verifyApiJwt(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.sub).toBe("user-123");
    expect(result.payload?.email).toBe("user@example.com");
    expect(result.payload?.scopes).toEqual(["read", "write"]);
  });

  it("rejects an expired JWT", () => {
    const payload = { sub: "user-123" };
    // Token that expired 10 seconds ago
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = generateApiJwt(payload, { expiresInSeconds: -10 });

    const result = verifyApiJwt(token);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("expired");
  });

  it("rejects a malformed JWT", () => {
    expect(verifyApiJwt("not.a.valid.jwt.string").valid).toBe(false);
    expect(verifyApiJwt("header.payload").valid).toBe(false);
    expect(verifyApiJwt("").valid).toBe(false);
  });

  it("rejects a token with an invalid signature", () => {
    const token = generateApiJwt({ sub: "user-123" });
    const parts = token.split(".");
    // Tamper with payload
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: "hacker" })).toString("base64");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = verifyApiJwt(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  it("rejects a token signed with a different secret", () => {
    const token = generateApiJwt(
      { sub: "user-123" },
      { secret: "different-secret-key-32-chars-long" }
    );

    const result = verifyApiJwt(token);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  it("handles missing token gracefully", () => {
    const result = verifyApiJwt("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("missing_token");
  });
});
