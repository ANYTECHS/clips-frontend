import { WalletStorage, WalletStorageError } from "@/app/lib/walletStorage";
import { secureStorage } from "@/app/lib/secureStorage";
import type { EncryptedPayload } from "@/app/lib/cryptoUtils";

// secureStorage's outer encryption is replaced with a pass-through so the
// tests can inspect exactly what WalletStorage hands it. The AES-GCM key
// encryption under test is real.
jest.mock("@/app/lib/secureStorage", () => {
  const store = new Map<string, string>();
  return {
    getCryptoSalt: jest.fn(() => btoa("0123456789abcdef")),
    secureStorage: {
      setItem: jest.fn(async (name: string, value: string) => {
        store.set(name, value);
        localStorage.setItem(name, `encrypted:${name}`);
      }),
      getItem: jest.fn(async (name: string) => store.get(name) ?? null),
      removeItem: jest.fn(async (name: string) => {
        store.delete(name);
      }),
      __store: store,
    },
  };
});

const SECRET = "SBXXSECRETKEYMOCKVALUEFORTESTSONLY000000000000000000000";

function baseRecord(userId: string) {
  return {
    userId,
    publicKey: "G_PUBLIC_KEY_MOCK",
    network: "testnet" as const,
    createdAt: new Date().toISOString(),
    walletType: "embedded" as const,
  };
}

function storedPayload(userId: string): string {
  const store = (secureStorage as unknown as { __store: Map<string, string> }).__store;
  return store.get(`clipcash_ew_${userId}`)!;
}

describe("WalletStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    (secureStorage as unknown as { __store: Map<string, string> }).__store.clear();
    jest.clearAllMocks();
  });

  describe("encryption", () => {
    it("encrypts the private key with AES-GCM before persisting", async () => {
      await WalletStorage.save("user-1", { ...baseRecord("user-1"), secretKey: SECRET });

      const serialized = storedPayload("user-1");
      expect(serialized).not.toContain(SECRET);
      expect(localStorage.getItem("clipcash_ew_user-1")).not.toContain(SECRET);

      const stored = JSON.parse(serialized);
      expect(stored.secretKey).toBeUndefined();
      const payload: EncryptedPayload = stored.encryptedSecretKey;
      expect(payload).toMatchObject({ v: 1, alg: "AES-GCM", kdf: "PBKDF2-SHA256" });
      expect(payload.iterations).toBeGreaterThanOrEqual(100_000);
      expect(typeof payload.iv).toBe("string");
      expect(typeof payload.salt).toBe("string");
      expect(typeof payload.ciphertext).toBe("string");
    });

    it("uses the salt maintained by CryptoSaltInitializer", async () => {
      await WalletStorage.save("user-1", { ...baseRecord("user-1"), secretKey: SECRET });

      const stored = JSON.parse(storedPayload("user-1"));
      expect(stored.encryptedSecretKey.salt).toBe(btoa("0123456789abcdef"));
    });

    it("never returns the plaintext key from get()", async () => {
      await WalletStorage.save("user-1", { ...baseRecord("user-1"), secretKey: SECRET });

      const record = await WalletStorage.get("user-1");
      expect(record).toMatchObject({ publicKey: "G_PUBLIC_KEY_MOCK" });
      expect(JSON.stringify(record)).not.toContain(SECRET);
    });
  });

  describe("decryption", () => {
    it("decrypts with the user's password", async () => {
      await WalletStorage.save(
        "user-2",
        { ...baseRecord("user-2"), secretKey: SECRET },
        "correct horse battery staple",
      );

      await expect(
        WalletStorage.getSecretKey("user-2", "correct horse battery staple"),
      ).resolves.toBe(SECRET);
    });

    it("decrypts with the device master key when no password is used", async () => {
      await WalletStorage.save("user-2", { ...baseRecord("user-2"), secretKey: SECRET });
      await expect(WalletStorage.getSecretKey("user-2")).resolves.toBe(SECRET);
    });

    it("scopes the plaintext key to the signing callback", async () => {
      await WalletStorage.save("user-2", { ...baseRecord("user-2"), secretKey: SECRET }, "pw");
      const sign = jest.fn((key: string) => `signed-with-${key.length}`);

      await expect(WalletStorage.withSecretKey("user-2", sign, "pw")).resolves.toBe(
        `signed-with-${SECRET.length}`,
      );
      expect(sign).toHaveBeenCalledWith(SECRET);
    });

    it("fails with the wrong password", async () => {
      await WalletStorage.save("user-3", { ...baseRecord("user-3"), secretKey: SECRET }, "right");

      const attempt = WalletStorage.getSecretKey("user-3", "wrong");
      await expect(attempt).rejects.toBeInstanceOf(WalletStorageError);
      await expect(attempt).rejects.toMatchObject({ code: "DECRYPTION_ERROR" });
      await attempt.catch((err: Error) => expect(err.message).not.toContain(SECRET));
    });

    it("detects tampered ciphertext", async () => {
      await WalletStorage.save("user-4", { ...baseRecord("user-4"), secretKey: SECRET }, "pw");

      const store = (secureStorage as unknown as { __store: Map<string, string> }).__store;
      const stored = JSON.parse(storedPayload("user-4"));
      const bytes = Uint8Array.from(atob(stored.encryptedSecretKey.ciphertext), (c) =>
        c.charCodeAt(0),
      );
      bytes[0] ^= 0xff;
      stored.encryptedSecretKey.ciphertext = btoa(String.fromCharCode(...bytes));
      store.set("clipcash_ew_user-4", JSON.stringify(stored));

      await expect(WalletStorage.getSecretKey("user-4", "pw")).rejects.toMatchObject({
        code: "DECRYPTION_ERROR",
      });
    });
  });

  describe("legacy migration", () => {
    it("re-encrypts legacy base64-encoded secrets", async () => {
      localStorage.setItem(
        "clipcash_ew_legacy-user",
        JSON.stringify({ ...baseRecord("legacy-user"), _encodedSecret: btoa(SECRET) }),
      );

      const record = await WalletStorage.get("legacy-user");
      expect(JSON.stringify(record)).not.toContain(SECRET);
      expect(storedPayload("legacy-user")).not.toContain(SECRET);
      await expect(WalletStorage.getSecretKey("legacy-user")).resolves.toBe(SECRET);
    });

    it("re-encrypts records that held a plaintext secretKey", async () => {
      const store = (secureStorage as unknown as { __store: Map<string, string> }).__store;
      store.set(
        "clipcash_ew_old-user",
        JSON.stringify({ ...baseRecord("old-user"), secretKey: SECRET }),
      );
      localStorage.setItem("clipcash_ew_old-user", "encrypted-record");

      await WalletStorage.get("old-user");
      expect(storedPayload("old-user")).not.toContain(SECRET);
      await expect(WalletStorage.getSecretKey("old-user")).resolves.toBe(SECRET);
    });
  });

  it("checks existence and removes records", async () => {
    await WalletStorage.save("user-5", { ...baseRecord("user-5"), secretKey: SECRET });
    await expect(WalletStorage.exists("user-5")).resolves.toBe(true);

    await WalletStorage.remove("user-5");
    expect(secureStorage.removeItem).toHaveBeenCalledWith("clipcash_ew_user-5");
    await expect(WalletStorage.exists("user-5")).resolves.toBe(false);
  });
});
