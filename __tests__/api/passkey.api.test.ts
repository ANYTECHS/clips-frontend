/**
 * Unit tests for /api/auth/passkey/register and /api/auth/passkey/authenticate routes.
 */

import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSession = { user: { id: "user-123", email: "test@clipcash.ai" } };

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue(mockSession),
}));

jest.mock("@/app/lib/csrf", () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockRegistrationOptions = {
  challenge: "test-challenge-base64",
  rp: { name: "ClipCash", id: "localhost" },
  user: { id: "dXNlci0xMjM=", name: "test@clipcash.ai", displayName: "test" },
  pubKeyCredParams: [],
  excludeCredentials: [],
};

const mockAuthOptions = {
  challenge: "auth-challenge-base64",
  rpId: "localhost",
  allowCredentials: [],
  userVerification: "preferred",
};

const mockVerifyRegistration = {
  verified: true,
  registrationInfo: {
    credentialID: "cred-id-abc",
    credentialPublicKey: new Uint8Array([1, 2, 3, 4]),
    counter: 0,
  },
};

const mockVerifyAuthentication = {
  verified: true,
  authenticationInfo: {
    newCounter: 1,
  },
};

jest.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: jest.fn().mockResolvedValue(mockRegistrationOptions),
  verifyRegistrationResponse: jest.fn().mockResolvedValue(mockVerifyRegistration),
  generateAuthenticationOptions: jest.fn().mockResolvedValue(mockAuthOptions),
  verifyAuthenticationResponse: jest.fn().mockResolvedValue(mockVerifyAuthentication),
}));

// Reset the store between tests via module-level import
import { passkeyStore } from "@/app/api/auth/passkey/passkeyStore";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/auth/passkey/register", {
    method,
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("/api/auth/passkey/register", () => {
  let GET: (req: NextRequest) => Promise<Response>;
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const route = await import("@/app/api/auth/passkey/register/route");
    GET = route.GET;
    POST = route.POST;
  });

  beforeEach(() => {
    passkeyStore.clear();
  });

  it("GET returns registration options for authenticated user", async () => {
    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ challenge: expect.any(String) });
  });

  it("GET returns 401 when not authenticated", async () => {
    const { auth } = await import("@/app/lib/auth");
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("POST verifies and stores credential", async () => {
    // First GET to set challenge
    await GET(makeRequest("GET"));

    const regResponse = {
      id: "cred-id-abc",
      rawId: "cred-id-abc",
      type: "public-key",
      response: {
        clientDataJSON: "base64data",
        attestationObject: "base64data",
        transports: ["internal"],
      },
    };

    const req = makeRequest("POST", regResponse);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.credentialId).toBeTruthy();
    expect(json.publicKey).toMatch(/^G/);
  });

  it("POST returns 400 when no challenge exists", async () => {
    const regResponse = { id: "some-id", type: "public-key" };
    const req = makeRequest("POST", regResponse);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/challenge/i);
  });

  it("POST returns 400 when verification fails", async () => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    (verifyRegistrationResponse as jest.Mock).mockResolvedValueOnce({ verified: false });

    // Set a challenge
    await GET(makeRequest("GET"));

    const req = makeRequest("POST", { id: "bad-id" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/verification failed/i);
  });
});

describe("/api/auth/passkey/authenticate", () => {
  let GET: (req: NextRequest) => Promise<Response>;
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const route = await import("@/app/api/auth/passkey/authenticate/route");
    GET = route.GET;
    POST = route.POST;
  });

  beforeEach(() => {
    passkeyStore.clear();
  });

  function seedCredential() {
    passkeyStore.addCredential("user-123", {
      credentialId: "stored-cred-id",
      publicKey: "GAAAAAABCDEF",
      userId: "user-123",
      counter: 0,
      transports: ["internal"],
      createdAt: new Date().toISOString(),
      stellarPublicKey: "GPUBKEY1234",
    });
  }

  it("GET returns authentication options for user with passkeys", async () => {
    seedCredential();

    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ challenge: expect.any(String) });
  });

  it("GET returns 404 when user has no passkeys", async () => {
    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/No passkeys/i);
  });

  it("GET returns 401 when not authenticated", async () => {
    const { auth } = await import("@/app/lib/auth");
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const req = makeRequest("GET");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("POST verifies authentication assertion and updates counter", async () => {
    seedCredential();

    // GET to set challenge
    await GET(makeRequest("GET"));

    const authResponse = {
      id: "stored-cred-id",
      rawId: "stored-cred-id",
      type: "public-key",
      response: {
        clientDataJSON: "base64data",
        authenticatorData: "base64data",
        signature: "base64data",
      },
    };

    const req = makeRequest("POST", authResponse);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(json.publicKey).toBe("GPUBKEY1234");
  });

  it("POST returns 400 when credential not found", async () => {
    const req = makeRequest("POST", { id: "unknown-cred-id" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("POST returns 400 when verification fails", async () => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    (verifyAuthenticationResponse as jest.Mock).mockResolvedValueOnce({ verified: false });

    seedCredential();
    await GET(makeRequest("GET"));

    const req = makeRequest("POST", { id: "stored-cred-id" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/verification failed/i);
  });
});
