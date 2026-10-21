/**
 * Server-side helpers for minting a clip as an NFT on the Soroban contract
 * configured by `NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID`.
 *
 * Contract interface expected:
 *   mint(to: Address, title: String, description: String, uri: String, royalty_bps: u32) -> u64
 * The returned value is stored as the clip's NFT token id.
 */

import * as StellarSdk from "@stellar/stellar-sdk";

import {
  calculateClipMintCost,
  type ClipNftMetadata,
  type MintCostEstimate,
  royaltyPercentToBps,
} from "@/app/lib/mintUtils";
import { getNetworkPassphrase, getRpcUrl, type StellarNetwork } from "@/app/lib/networkConfig";

/** Thrown when a mint cannot be built or verified; `status` maps to the HTTP response. */
export class ClipMintError extends Error {
  /**
   * @param code - Machine-readable reason.
   * @param message - Human-readable explanation.
   * @param status - Suggested HTTP status.
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "ClipMintError";
  }
}

export interface BuildClipMintParams {
  publicKey: string;
  contractId: string;
  metadata: ClipNftMetadata;
  /** Absolute URL of the NFT metadata/media. */
  uri: string;
  network: StellarNetwork;
}

const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1_500;

function rpcServer(network: StellarNetwork) {
  return new StellarSdk.rpc.Server(getRpcUrl(network));
}

/**
 * Build, simulate and assemble the contract `mint` call for the user to sign.
 *
 * @returns The prepared transaction XDR and the estimated mint cost.
 * @throws {ClipMintError} When the account is unfunded or the simulation fails.
 */
export async function buildClipMintTransaction(
  params: BuildClipMintParams
): Promise<{ xdr: string; estimate: MintCostEstimate }> {
  const { publicKey, contractId, metadata, uri, network } = params;
  const server = rpcServer(network);

  let account: StellarSdk.Account;
  try {
    account = await server.getAccount(publicKey);
  } catch {
    throw new ClipMintError(
      "ACCOUNT_NOT_FOUND",
      "Your Stellar account is not activated. Fund it before minting.",
      400
    );
  }

  const operation = new StellarSdk.Contract(contractId).call(
    "mint",
    StellarSdk.Address.fromString(publicKey).toScVal(),
    StellarSdk.nativeToScVal(metadata.title, { type: "string" }),
    StellarSdk.nativeToScVal(metadata.description, { type: "string" }),
    StellarSdk.nativeToScVal(uri, { type: "string" }),
    StellarSdk.nativeToScVal(royaltyPercentToBps(metadata.royaltyPercent), { type: "u32" })
  );

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: getNetworkPassphrase(network),
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new ClipMintError("SIMULATION_FAILED", `Mint simulation failed: ${simulation.error}`, 400);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulation).build();

  return {
    xdr: prepared.toEnvelope().toXDR("base64"),
    estimate: calculateClipMintCost({
      inclusionFeeStroops: Number(StellarSdk.BASE_FEE),
      resourceFeeStroops: Number(simulation.minResourceFee),
    }),
  };
}

/**
 * Confirm that `txHash` is a successful `mint` call on the NFT contract for
 * `publicKey`, and return the minted token id.
 *
 * @throws {ClipMintError} When the transaction is missing, failed or not a matching mint.
 */
export async function verifyClipMintTransaction(params: {
  txHash: string;
  publicKey: string;
  contractId: string;
  network: StellarNetwork;
}): Promise<{ tokenId: string; ledger: number }> {
  const { txHash, publicKey, contractId, network } = params;
  const server = rpcServer(network);

  let result = await server.getTransaction(txHash);
  for (let i = 0; i < POLL_ATTEMPTS && result.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    result = await server.getTransaction(txHash);
  }

  if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
    throw new ClipMintError("TX_NOT_FOUND", "Mint transaction not found yet. Try again shortly.", 404);
  }
  if (result.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new ClipMintError("TX_FAILED", "Mint transaction failed on-chain.", 400);
  }

  // Unwrap fee-bump envelopes (sponsored mints) to the user's inner transaction
  const envelope = StellarSdk.TransactionBuilder.fromXDR(
    result.envelopeXdr,
    getNetworkPassphrase(network)
  );
  const tx = envelope instanceof StellarSdk.FeeBumpTransaction ? envelope.innerTransaction : envelope;
  const op = tx.operations[0];

  const isMatchingMint = (() => {
    if (tx.operations.length !== 1 || op?.type !== "invokeHostFunction") return false;
    if (op.func.switch().value !== StellarSdk.xdr.HostFunctionType.hostFunctionTypeInvokeContract().value) {
      return false;
    }
    const invoke = op.func.invokeContract();
    const to = invoke.args()[0];
    return (
      StellarSdk.Address.fromScAddress(invoke.contractAddress()).toString() === contractId &&
      invoke.functionName().toString() === "mint" &&
      to !== undefined &&
      StellarSdk.scValToNative(to) === publicKey
    );
  })();

  if (!isMatchingMint) {
    throw new ClipMintError("TX_MISMATCH", "Transaction is not a mint for this account.", 400);
  }
  if (!result.returnValue) {
    throw new ClipMintError("NO_TOKEN_ID", "Mint transaction did not return a token id.", 400);
  }

  return {
    tokenId: String(StellarSdk.scValToNative(result.returnValue)),
    ledger: result.ledger,
  };
}
