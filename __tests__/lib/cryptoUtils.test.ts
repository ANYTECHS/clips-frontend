import {
  encryptWithPassword,
  decryptWithPassword,
  encryptToPayload,
  decryptFromPayload,
} from "@/app/lib/cryptoUtils";

describe("encryptWithPassword / decryptWithPassword", () => {
  it("encrypts and decrypts a plaintext string correctly", async () => {
    const plaintext = "my-secret-stellar-key-SABCDEFGHIJKLMNOP";
    const password = "strong-recovery-password";

    const encrypted = await encryptWithPassword(plaintext, password);
    expect(typeof encrypted).toBe("string");
    expect(encrypted.length).toBeGreaterThan(0);

    const decrypted = await decryptWithPassword(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (nonce/salt randomness)", async () => {
    const plaintext = "consistent-data";
    const password = "same-password";

    const enc1 = await encryptWithPassword(plaintext, password);
    const enc2 = await encryptWithPassword(plaintext, password);

    expect(enc1).not.toBe(enc2);
  });

  it("throws when decrypting with the wrong password", async () => {
    const plaintext = "secret-message";
    const encrypted = await encryptWithPassword(plaintext, "correct-password");

    await expect(decryptWithPassword(encrypted, "wrong-password")).rejects.toThrow();
  });

  it("throws when decrypting corrupted ciphertext", async () => {
    await expect(decryptWithPassword("not-valid-base64!!", "password")).rejects.toThrow();
  });

  it("handles empty string plaintext", async () => {
    const encrypted = await encryptWithPassword("", "password");
    const decrypted = await decryptWithPassword(encrypted, "password");
    expect(decrypted).toBe("");
  });

  it("handles special characters in password", async () => {
    const plaintext = "wallet-mnemonic-phrase";
    const password = "p@ssw0rd!#$%^&*()_+-=[]{}|;:',.<>?/~`";

    const encrypted = await encryptWithPassword(plaintext, password);
    const decrypted = await decryptWithPassword(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it("handles unicode characters in plaintext", async () => {
    const plaintext = "café-über-漢字";
    const password = "unicode-pass";

    const encrypted = await encryptWithPassword(plaintext, password);
    const decrypted = await decryptWithPassword(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it("handles long plaintext (wallet-size data)", async () => {
    const plaintext = "x".repeat(1024);
    const password = "long-data-password";

    const encrypted = await encryptWithPassword(plaintext, password);
    const decrypted = await decryptWithPassword(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });
});

describe("encryptToPayload / decryptFromPayload", () => {
  it("round-trips through a single serializable payload", async () => {
    const payload = await encryptToPayload("S-SECRET", "password");
    const restored = JSON.parse(JSON.stringify(payload));

    expect(restored).toMatchObject({ v: 1, alg: "AES-GCM", kdf: "PBKDF2-SHA256" });
    expect(restored.iterations).toBeGreaterThanOrEqual(100_000);
    await expect(decryptFromPayload(restored, "password")).resolves.toBe("S-SECRET");
  });

  it("uses a fresh IV for every encryption", async () => {
    const salt = new Uint8Array(16);
    const a = await encryptToPayload("same", "pw", salt);
    const b = await encryptToPayload("same", "pw", salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails with the wrong password", async () => {
    const payload = await encryptToPayload("S-SECRET", "right");
    await expect(decryptFromPayload(payload, "wrong")).rejects.toThrow();
  });

  it("detects tampered ciphertext", async () => {
    const payload = await encryptToPayload("S-SECRET", "pw");
    const bytes = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0x01;
    const tampered = { ...payload, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptFromPayload(tampered, "pw")).rejects.toThrow();
  });

  it("rejects payloads with a weakened iteration count", async () => {
    const payload = await encryptToPayload("S-SECRET", "pw");
    await expect(decryptFromPayload({ ...payload, iterations: 1000 }, "pw")).rejects.toThrow(
      /iteration/,
    );
  });
});
