/**
 * @integration
 *
 * End-to-end NFT mint on the public Stellar testnet with fee sponsorship:
 * a user whose account holds only the minimum reserve (0 spendable XLM)
 * mints a clip NFT while the sponsor pays the fee via a fee-bump envelope.
 *
 * Requires:
 *   SPONSOR_SECRET_KEY                   — funded testnet sponsor account
 *   NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID  — deployed NFT contract exposing
 *     mint(to: Address, title: String, description: String, uri: String, royalty_bps: u32) -> u64
 *
 * Skipped when either variable is missing. Run with:
 *   npm run test:integration
 */

import * as StellarSdk from "@stellar/stellar-sdk";

import { buildClipMintTransaction, verifyClipMintTransaction } from "@/app/api/lib/clipNftMint";
import { isEligibleForSponsorship, validateInnerTransaction } from "@/app/api/lib/sponsorshipPolicy";
import { buildClipNftMetadata } from "@/app/lib/mintUtils";
import { getHorizonUrl, getRpcUrl } from "@/app/lib/networkConfig";
import { buildFeeBumpedTx, fetchAccountXlmStatus } from "@/app/lib/stellarTransaction";

const SPONSOR_SECRET = process.env.SPONSOR_SECRET_KEY;
const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID;
const describeTestnet = SPONSOR_SECRET && CONTRACT_ID ? describe : describe.skip;

const PASSPHRASE = StellarSdk.Networks.TESTNET;

async function waitForSuccess(server: StellarSdk.rpc.Server, hash: string) {
  for (let i = 0; i < 20; i++) {
    const res = await server.getTransaction(hash);
    if (res.status !== StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) return res;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Transaction ${hash} not found after polling`);
}

describeTestnet("Sponsored NFT mint on testnet (Issues #1220, #1221)", () => {
  jest.setTimeout(120_000);

  const sponsor = StellarSdk.Keypair.fromSecret(SPONSOR_SECRET ?? StellarSdk.Keypair.random().secret());
  const user = StellarSdk.Keypair.random();
  const horizon = new StellarSdk.Horizon.Server(getHorizonUrl("testnet"));
  const rpc = new StellarSdk.rpc.Server(getRpcUrl("testnet"));

  beforeAll(async () => {
    // Create the user with exactly the minimum reserve (2 × 0.5 XLM) so no XLM is spendable
    const sponsorAccount = await horizon.loadAccount(sponsor.publicKey());
    const createTx = new StellarSdk.TransactionBuilder(sponsorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({ destination: user.publicKey(), startingBalance: "1" })
      )
      .setTimeout(60)
      .build();
    createTx.sign(sponsor);
    await horizon.submitTransaction(createTx);
  });

  it("mints a clip NFT for a user with 0 spendable XLM via fee sponsorship", async () => {
    const before = await fetchAccountXlmStatus(user.publicKey(), "testnet");
    expect(before.spendable).toBe(0);

    const metadata = buildClipNftMetadata({
      id: "integration",
      title: `Integration clip ${Date.now()}`,
      thumbnail: "/projects/thumb1.png",
      status: "completed",
    });

    // 1. Build + simulate the contract mint call
    const { xdr, estimate } = await buildClipMintTransaction({
      publicKey: user.publicKey(),
      contractId: CONTRACT_ID!,
      metadata,
      uri: "https://example.com/projects/thumb1.png",
      network: "testnet",
    });
    expect(estimate.totalXlm).toBeGreaterThan(0);

    // 2. User signs the inner transaction
    const inner = StellarSdk.TransactionBuilder.fromXDR(xdr, PASSPHRASE) as StellarSdk.Transaction;
    inner.sign(user);
    const innerXdr = inner.toEnvelope().toXDR("base64");

    // 3. Sponsorship eligibility + fee bump (what POST /api/sponsorship/sponsor does)
    const validation = validateInnerTransaction(innerXdr, user.publicKey(), "testnet", CONTRACT_ID);
    expect(validation).toMatchObject({ ok: true, operations: ["mint"] });
    expect(isEligibleForSponsorship(before, Number(inner.fee))).toBe(true);

    const feeBump = buildFeeBumpedTx(innerXdr, sponsor, { network: "testnet" });

    // 4. Submit and confirm
    const sent = await rpc.sendTransaction(feeBump);
    expect(sent.status).not.toBe("ERROR");
    const confirmed = await waitForSuccess(rpc, sent.hash);
    expect(confirmed.status).toBe(StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS);

    // 5. The mint is recognised and returns a token id; the user paid nothing
    const { tokenId } = await verifyClipMintTransaction({
      txHash: sent.hash,
      publicKey: user.publicKey(),
      contractId: CONTRACT_ID!,
      network: "testnet",
    });
    expect(tokenId).toBeTruthy();

    const after = await fetchAccountXlmStatus(user.publicKey(), "testnet");
    expect(after.balance).toBe(before.balance);
  });
});
