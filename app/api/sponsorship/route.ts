import { NextResponse } from "next/server";

import {
  estimateSponsoredFee,
  getSponsorBalance,
  hasSufficientSponsorBalance,
} from "@/app/api/lib/feeSponsorship";
import { logger } from "@/app/lib/logger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publicKey = searchParams.get("publicKey");
    const operationCount = parseInt(searchParams.get("operationCount") || "1", 10);

    if (!publicKey) {
      return NextResponse.json({ error: "Missing publicKey parameter" }, { status: 400 });
    }

    const [balance, sufficient] = await Promise.all([
      getSponsorBalance(publicKey),
      hasSufficientSponsorBalance(publicKey, undefined, 5),
    ]);

    const feeEstimate = estimateSponsoredFee(operationCount);

    return NextResponse.json({
      sponsorBalance: balance,
      isAvailable: sufficient,
      feeEstimate,
    });
  } catch (error: any) {
    logger.error("Sponsorship check failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check sponsorship" },
      { status: 500 }
    );
  }
}
