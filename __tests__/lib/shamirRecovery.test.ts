import { combineShares, splitSecret } from "@/app/lib/shamirRecovery";

describe("shamirRecovery", () => {
  it("splits and recombines a secret with threshold t-of-n", () => {
    const secret = "encrypted-wallet-backup-payload";
    const shares = splitSecret(secret, 3, 2);
    expect(shares).toHaveLength(3);
    expect(shares[0].length).toBeGreaterThan(0);

    const restored = combineShares([shares[0], shares[2]]);
    expect(restored).toBe(secret);
  });

  it("still accepts the legacy options object", () => {
    const secret = "another-secret";
    const shares = splitSecret(secret, { shares: 4, threshold: 3 });
    const restored = combineShares([shares[0], shares[1], shares[3]]);
    expect(restored).toBe(secret);
  });

  it("recombines a 3-of-5 split from any 3 shares", () => {
    const secret = "SBX4KXQ2V5GLW2RZ7L4VGQUJ2YXQ7FJZQ7WQ3XJ6R3K2PQLM4N5O6P7Q";
    const shares = splitSecret(secret, 5, 3);
    expect(shares).toHaveLength(5);

    expect(combineShares([shares[0], shares[1], shares[2]], 3)).toBe(secret);
    expect(combineShares([shares[4], shares[2], shares[0]], 3)).toBe(secret);
    expect(combineShares([shares[1], shares[3], shares[4]], 3)).toBe(secret);
  });

  it("recombines when more than threshold shares are supplied", () => {
    const secret = "more-than-enough";
    const shares = splitSecret(secret, 5, 3);
    expect(combineShares(shares, 3)).toBe(secret);
  });

  it("fails with insufficient shares when the threshold is known", () => {
    const shares = splitSecret("top-secret", 5, 3);
    expect(() => combineShares([shares[0], shares[1]], 3)).toThrow(/insufficient shares/i);
  });

  it("does not reveal the secret from fewer than threshold shares", () => {
    const secret = "top-secret";
    const shares = splitSecret(secret, 5, 3);
    // Without a threshold hint the math still runs, but yields the wrong value.
    expect(combineShares([shares[0], shares[1]])).not.toBe(secret);
  });

  it("treats duplicate shares as a single share", () => {
    const shares = splitSecret("dup-check", 3, 2);
    expect(() => combineShares([shares[0], shares[0]], 2)).toThrow(/insufficient shares/i);
  });

  it("rejects a single share", () => {
    const shares = splitSecret("single", 3, 2);
    expect(() => combineShares([shares[0]])).toThrow(/insufficient shares/i);
  });

  it("validates split parameters", () => {
    expect(() => splitSecret("x", 3, 1)).toThrow(/at least 2/);
    expect(() => splitSecret("x", 2, 3)).toThrow(/at least the recovery threshold/);
    expect(() => splitSecret("", 3, 2)).toThrow(/must not be empty/);
  });
});
