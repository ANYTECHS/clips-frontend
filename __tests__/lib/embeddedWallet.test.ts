import { createEmbeddedWallet } from "@/app/lib/embeddedWallet";
import { StrKey, Keypair, TransactionBuilder, Networks, Operation } from "@stellar/stellar-sdk";

// Mock WalletStorage and secureStorage because embeddedWallet relies on them
jest.mock("@/app/lib/walletStorage", () => ({
  WalletStorage: {
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("embeddedWallet generation", () => {
  it("should generate valid Stellar Ed25519 keys", async () => {
    const result = await createEmbeddedWallet("test-user", "testnet", false);

    expect(result.wallet.publicKey).toBeDefined();
    expect(result.secretKey).toBeDefined();

    // Verify it passes StrKey validation
    expect(StrKey.isValidEd25519PublicKey(result.wallet.publicKey)).toBe(true);
    expect(StrKey.isValidEd25519SecretSeed(result.secretKey!)).toBe(true);
  });

  it("should sign a test transaction and verify the signature successfully", async () => {
    const result = await createEmbeddedWallet("test-user-2", "testnet", false);
    
    // Create a keypair from the secret to use for signing
    const keypair = Keypair.fromSecret(result.secretKey!);
    expect(keypair.publicKey()).toBe(result.wallet.publicKey);

    // Build a dummy transaction
    const dummyAccount = new (jest.requireActual("@stellar/stellar-sdk").Account)(keypair.publicKey(), "1");
    const tx = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: jest.requireActual("@stellar/stellar-sdk").Asset.native(),
        amount: "10",
      }))
      .setTimeout(30)
      .build();

    // Sign the transaction
    tx.sign(keypair);

    // Verify signature
    const isVerified = keypair.verify(tx.hash(), tx.signatures[0].signature());
    expect(isVerified).toBe(true);
  });
});
