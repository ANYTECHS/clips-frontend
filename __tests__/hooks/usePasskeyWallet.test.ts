/**
 * Unit tests for usePasskeyWallet hook.
 */

import { renderHook, act } from "@testing-library/react";
import { usePasskeyWallet } from "@/app/hooks/usePasskeyWallet";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockStartRegistration = jest.fn();
const mockStartAuthentication = jest.fn();
let mockBrowserSupport = true;

jest.mock("@simplewebauthn/browser", () => ({
  startRegistration: (...args: unknown[]) => mockStartRegistration(...args),
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
  browserSupportsWebAuthn: () => mockBrowserSupport,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((k: string) => store[k] ?? null),
    setItem: jest.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: jest.fn((k: string) => { delete store[k]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRegisterFlow(optionsBody = {}, verifyBody = { credentialId: "test-cred-id", publicKey: "GPUBKEYTESTVALUE123456789012345678901234567890123456" }) {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "test-challenge", ...optionsBody }) })
    .mockResolvedValueOnce({ ok: true, json: async () => verifyBody });

  mockStartRegistration.mockResolvedValueOnce({
    id: "test-cred-id",
    rawId: "test-cred-id",
    type: "public-key",
    response: { transports: ["internal"] },
  });
}

function mockAuthFlow(optionsBody = {}, verifyBody = { verified: true, credentialId: "test-cred-id", publicKey: "GPUBKEYAUTH" }) {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "auth-challenge", ...optionsBody }) })
    .mockResolvedValueOnce({ ok: true, json: async () => verifyBody });

  mockStartAuthentication.mockResolvedValueOnce({
    id: "test-cred-id",
    rawId: "test-cred-id",
    type: "public-key",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset();
  mockStartRegistration.mockReset();
  mockStartAuthentication.mockReset();
  localStorageMock.clear();
  localStorageMock.getItem.mockImplementation((k: string) => null);
  mockBrowserSupport = true;
});

describe("usePasskeyWallet — browser support", () => {
  it("sets isSupported=true when browserSupportsWebAuthn returns true", () => {
    mockBrowserSupport = true;
    const { result } = renderHook(() => usePasskeyWallet());
    expect(result.current.isSupported).toBe(true);
  });

  it("sets isSupported=false and returns false from register when unsupported", async () => {
    mockBrowserSupport = false;
    const { result } = renderHook(() => usePasskeyWallet());

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toMatch(/not supported/i);
  });

  it("sets isSupported=false and returns false from authenticate when unsupported", async () => {
    mockBrowserSupport = false;
    const { result } = renderHook(() => usePasskeyWallet());

    let success: boolean;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toMatch(/not supported/i);
  });
});

describe("usePasskeyWallet — registration", () => {
  it("returns true and updates state on successful registration", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockRegisterFlow();

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(true);
    expect(result.current.credentialId).toBe("test-cred-id");
    expect(result.current.publicKey).toMatch(/^G/);
    expect(result.current.isRegistering).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns false and sets error when options fetch fails", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Server error" }) });

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.isRegistering).toBe(false);
  });

  it("returns false and sets error when verify endpoint fails", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "test" }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Verification failed" }) });

    mockStartRegistration.mockResolvedValueOnce({ id: "x", type: "public-key" });

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it("handles NotAllowedError from browser with descriptive message", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "test" }) });

    const notAllowedError = new DOMException("User cancelled", "NotAllowedError");
    mockStartRegistration.mockRejectedValueOnce(notAllowedError);

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe("Passkey registration was cancelled by the user.");
    expect(result.current.isRegistering).toBe(false);
  });

  it("handles Error subclasses with NotAllowedError name", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "test" }) });

    const errLike = Object.assign(new Error("Cancelled"), { name: "NotAllowedError" });
    mockStartRegistration.mockRejectedValueOnce(errLike);

    let success: boolean;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe("Passkey registration was cancelled by the user.");
  });
});

describe("usePasskeyWallet — authentication", () => {
  it("returns true and updates state on successful authentication", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockAuthFlow();

    let success: boolean;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success!).toBe(true);
    expect(result.current.credentialId).toBe("test-cred-id");
    expect(result.current.publicKey).toBe("GPUBKEYAUTH");
    expect(result.current.isAuthenticating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns false and sets error when options fetch fails", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Not found" }) });

    let success: boolean;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticating).toBe(false);
  });

  it("handles NotAllowedError from browser with descriptive message", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: "auth-challenge" }) });

    const notAllowedError = new DOMException("User cancelled", "NotAllowedError");
    mockStartAuthentication.mockRejectedValueOnce(notAllowedError);

    let success: boolean;
    await act(async () => {
      success = await result.current.authenticate();
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe("Passkey authentication was cancelled.");
    expect(result.current.isAuthenticating).toBe(false);
  });
});

describe("usePasskeyWallet — reset", () => {
  it("clears state and removes localStorage entry", async () => {
    const { result } = renderHook(() => usePasskeyWallet());
    mockRegisterFlow();

    await act(async () => {
      await result.current.register();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.credentialId).toBeNull();
    expect(result.current.publicKey).toBeNull();
    expect(result.current.error).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("clipcash_passkey_id");
  });
});
