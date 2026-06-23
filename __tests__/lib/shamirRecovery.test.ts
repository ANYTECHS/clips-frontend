import { combineShares, splitSecret } from "@/app/lib/shamirRecovery";

describe("shamirRecovery", () => {
  it("splits and recombines a secret with threshold t-of-n", () => {
    const secret = "encrypted-wallet-backup-payload";
    const shares = splitSecret(secret, { shares: 3, threshold: 2 });
    expect(shares).toHaveLength(3);
    expect(shares[0].length).toBeGreaterThan(0);

    const restored = combineShares([shares[0], shares[2]]);
    expect(restored).toBe(secret);
  });

  it("requires at least threshold shares to reconstruct", () => {
    const secret = "another-secret";
    const shares = splitSecret(secret, { shares: 4, threshold: 3 });
    const restored = combineShares([shares[0], shares[1], shares[3]]);
    expect(restored).toBe(secret);
  });
});
