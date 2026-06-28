import { encryptWithPassword, decryptWithPassword } from "@/app/lib/cryptoUtils";

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
