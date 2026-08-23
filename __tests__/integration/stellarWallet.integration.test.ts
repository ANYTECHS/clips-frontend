/**
 * @integration
 *
 * Stellar wallet operations against the public Stellar testnet
 * (Horizon + Friendbot). Optionally point at a local network by setting
 * `NEXT_PUBLIC_STELLAR_NETWORK=testnet` with a local Friendbot/Horizon
 * (stellar Quickstart / stellar-local-network) — see WALLET_TESTING_GUIDE.md.
 *
 * Run separately from unit tests:
 *   npm run test:integration
 */

import {
  Keypair,
  StrKey,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";
import { createEmbeddedWallet } from "@/app/lib/embeddedWallet";
import {
  buildPaymentTransaction,
  buildBatchTransaction,
  fundWithFriendbot,
  getBalance,
  getStellarServer,
} from "@/app/lib/stellar";
import {
  createPaymentOp,
  createChangeTrustOp,
} from "@/app/lib/stellarOperations";

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

/** Well-known SDF testnet USDC issuer (for change_trust batch op only). */
const TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const FRIENDBOT_RETRIES = 5;
const RETRY_DELAY_MS = 3_000;

function uniqueUserId(label: string): string {
  return `integration-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPositiveBalance(publicKey: string): Promise<string> {
  let balance = "0";
  for (let i = 0; i < 10; i++) {
    balance = await getBalance(publicKey);
    if (parseFloat(balance) > 0) return balance;
    await sleep(1_500);
  }
  return balance;
}

/**
 * Fund via Friendbot with retries. If Friendbot returns an error but the
 * account already exists on Horizon with balance > 0 (rate-limit / already
 * funded), treat that as success.
 */
async function fundWithRetry(publicKey: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FRIENDBOT_RETRIES; attempt++) {
    try {
      await fundWithFriendbot(publicKey);
      const balance = await waitForPositiveBalance(publicKey);
      if (parseFloat(balance) > 0) return;
    } catch (error) {
      lastError = error;
      const balance = await getBalance(publicKey).catch(() => "0");
      if (parseFloat(balance) > 0) return;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Friendbot funding failed after ${FRIENDBOT_RETRIES} attempts`);
}

describe("@integration Stellar wallet operations (testnet)", () => {
  jest.setTimeout(120_000);

  /** Shared funded sender — reused so we don't spam Friendbot. */
  let fundedSender: Keypair;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    fundedSender = Keypair.random();
    await fundWithRetry(fundedSender.publicKey());
  });

  it("createEmbeddedWallet() generates a valid Stellar keypair that Friendbot can fund", async () => {
    const result = await createEmbeddedWallet(
      uniqueUserId("create"),
      "testnet",
      false,
    );

    expect(result.alreadyExisted).toBe(false);
    expect(result.secretKey).toBeDefined();
    expect(StrKey.isValidEd25519PublicKey(result.wallet.publicKey)).toBe(true);
    expect(StrKey.isValidEd25519SecretSeed(result.secretKey!)).toBe(true);

    const keypair = Keypair.fromSecret(result.secretKey!);
    expect(keypair.publicKey()).toBe(result.wallet.publicKey);

    await fundWithRetry(result.wallet.publicKey);
    const balance = await getBalance(result.wallet.publicKey);
    expect(parseFloat(balance)).toBeGreaterThan(0);
  });

  it("fundWithFriendbot() leaves account balance > 0", async () => {
    const keypair = Keypair.random();
    const before = await getBalance(keypair.publicKey());
    expect(parseFloat(before)).toBe(0);

    await fundWithRetry(keypair.publicKey());

    const balance = await getBalance(keypair.publicKey());
    expect(parseFloat(balance)).toBeGreaterThan(0);
  });

  it("buildPaymentTransaction() has a payment operation and the expected fee", async () => {
    const destination = Keypair.random();
    const server = getStellarServer();
    const baseFee = await server.fetchBaseFee();

    const { transaction, fee } = await buildPaymentTransaction(
      fundedSender.publicKey(),
      destination.publicKey(),
      "1",
    );

    expect(transaction.operations).toHaveLength(1);
    expect(transaction.operations[0].type).toBe("payment");
    const paymentOp = transaction.operations[0] as {
      type: string;
      destination: string;
      amount: string;
    };
    expect(paymentOp.destination).toBe(destination.publicKey());
    expect(Number(paymentOp.amount)).toBe(1);

    expect(transaction.fee).toBe(baseFee.toString());
    expect(fee).toBe((baseFee / 10_000_000).toString());
  });

  it("buildBatchTransaction() with 2 operations returns valid XDR", async () => {
    const destination = Keypair.random();
    const server = getStellarServer();
    const baseFee = await server.fetchBaseFee();

    const result = await buildBatchTransaction(
      fundedSender.publicKey(),
      [
        createChangeTrustOp({
          assetCode: "USDC",
          assetIssuer: TESTNET_USDC_ISSUER,
          limit: "1000",
        }),
        createPaymentOp({
          destination: destination.publicKey(),
          amount: "0.5",
        }),
      ],
      { memo: "integration-batch" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.operationCount).toBe(2);
    expect(result.feeStroops).toBe(baseFee * 2);
    expect(result.xdr).toMatch(/^[A-Za-z0-9+/=]+$/);

    const parsed = TransactionBuilder.fromXDR(result.xdr, Networks.TESTNET);
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.operations[0].type).toBe("changeTrust");
    expect(parsed.operations[1].type).toBe("payment");
  });
});
