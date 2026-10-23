/**
 * @jest-environment node
 */
import {
  decryptShareForGuardian,
  encryptShareForGuardian,
  generateGuardianKeyPair,
  isValidGuardianPublicKey,
} from "@/app/lib/guardianCrypto";
import { combineShares, splitSecret } from "@/app/lib/shamirRecovery";

describe("guardianCrypto", () => {
  it("encrypts a share that only the guardian's private key can decrypt", async () => {
    const guardian = await generateGuardianKeyPair();
    const other = await generateGuardianKeyPair();
    const share = "801abcdef0123456789";

    const encrypted = await encryptShareForGuardian(share, guardian.publicKey);
    expect(encrypted).not.toContain(share);
    await expect(decryptShareForGuardian(encrypted, guardian.privateKey)).resolves.toBe(share);
    await expect(decryptShareForGuardian(encrypted, other.privateKey)).rejects.toThrow();
  });

  it("validates guardian public keys", async () => {
    const guardian = await generateGuardianKeyPair();
    await expect(isValidGuardianPublicKey(guardian.publicKey)).resolves.toBe(true);
    await expect(isValidGuardianPublicKey("not-a-key")).resolves.toBe(false);
  });

  it("supports the full split → encrypt → decrypt → combine flow", async () => {
    const secret = "encrypted-backup-ciphertext";
    const guardians = await Promise.all([1, 2, 3, 4, 5].map(() => generateGuardianKeyPair()));
    const shares = splitSecret(secret, 5, 3);
    const encrypted = await Promise.all(
      shares.map((s, i) => encryptShareForGuardian(s, guardians[i].publicKey))
    );

    const released = await Promise.all(
      [0, 2, 4].map((i) => decryptShareForGuardian(encrypted[i], guardians[i].privateKey))
    );
    expect(combineShares(released, 3)).toBe(secret);
  });
});
