import fc from "fast-check";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createPaymentOp, validateOperations } from "@/app/lib/stellarOperations";

const SEED = Number(process.env.FC_SEED ?? 1277);

describe("wallet input fuzz properties", () => {
  it("validates generated Stellar public key strings without crashing", () => {
    try {
      fc.assert(
        fc.property(fc.string({ maxLength: 256 }), (publicKey) => {
          expect(() => StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)).not.toThrow();
        }),
        { numRuns: 1_000, seed: SEED + 2 },
      );
    } catch (error) {
      console.error(`[fast-check] wallet-public-key seed=${SEED + 2}`);
      throw error;
    }
  });

  it("rejects invalid amounts and asset codes with typed validation errors", () => {
    try {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }),
          fc.string({ maxLength: 16 }),
          fc.string({ maxLength: 128 }),
          (amount, assetCode, assetIssuer) => {
            const operation = createPaymentOp({
              destination: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
              amount,
              assetCode,
              assetIssuer,
            });
            if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
              expect(() => validateOperations([operation])).toThrow(/positive numeric amount/i);
              } else if (assetCode && !assetIssuer) {
                expect(() => validateOperations([operation])).toThrow(/requires assetIssuer/i);
            } else {
              expect(() => validateOperations([operation])).not.toThrow();
            }
          },
        ),
        { numRuns: 1_000, seed: SEED + 3 },
      );
    } catch (error) {
      console.error(`[fast-check] wallet-amounts seed=${SEED + 3}`);
      throw error;
    }
  });
});
