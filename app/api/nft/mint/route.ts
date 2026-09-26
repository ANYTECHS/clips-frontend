import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { buildTransactionEnvelope, submitEnvelope } from "@/app/lib/stellarTransaction";
import { STELLAR_NETWORKS, StellarNetwork } from "@/app/lib/embeddedWallet";

// Helper to simulate the response logic since we might not have a real Soroban contract deployed in tests
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { publicKey, signedXdr, collectionName, description, listingPrice, creatorRoyalty } = body;

    const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet") as StellarNetwork;
    const contractId = process.env.NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID || "CC_MOCK_CONTRACT_ID";

    // 1. Build Phase
    if (!signedXdr) {
      if (!publicKey) {
        return NextResponse.json({ error: "publicKey is required to build the transaction" }, { status: 400 });
      }

      // In a real Soroban scenario, we would use the Soroban RPC to simulate the transaction
      // and get the required fee and resources.
      // We will create a mock envelope for the frontend to sign.
      // A real implementation would use Stellar SDK TransactionBuilder and SorobanRpc.
      
      const payload = {
        sourcePublicKey: publicKey,
        operationType: "invoke_contract",
        operationParams: {
          contractId,
          functionName: "mint",
          args: [collectionName, description, listingPrice, creatorRoyalty]
        },
        network,
      };

      // We'll return a dummy sequence of 0 for the build since the frontend will likely sign it
      // For a real implementation, we fetch the sequence, build the XDR, and return it.
      const unsignedXdr = buildTransactionEnvelope(payload, "0", "00000000000000000000000000000000"); 
      
      return NextResponse.json({ 
        xdr: unsignedXdr,
        networkPassphrase: STELLAR_NETWORKS[network].networkPassphrase
      });
    }

    // 2. Submit Phase
    // If the frontend has signed the transaction, we submit it
    const result = await submitEnvelope(signedXdr, network);
    
    // Parse result to get minted IDs if successful. For now, generate mock IDs.
    const nftIds = ["NFT_12345"];

    return NextResponse.json({
      data: { txHash: result.hash, nftIds },
      error: null
    });

  } catch (err: unknown) {
    console.error("NFT Mint Error:", err);
    
    // Map specific Stellar errors to UI expectations
    const error = err as { code?: string };
    
    // Map specific Stellar errors to UI expectations
    let errorMessage = "Internal server error";
    let status = 500;
    
    if (error.code === "tx_insufficient_fee") {
      errorMessage = "INSUFFICIENT_BALANCE";
      status = 400;
    } else if (error.code === "tx_bad_auth") {
      errorMessage = "WALLET_REJECTED";
      status = 400;
    } else if (error.code === "tx_failed" || error.code === "network_error") {
      errorMessage = "CONTRACT_ERROR";
      status = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
