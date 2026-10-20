import { NextRequest, NextResponse } from "next/server";
import { multisigStore } from "../multisigStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, txId, publicKey, signature, weight, txHash } = body;

    if (!txId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "txId is required",
        },
        { status: 400 }
      );
    }

    if (action === "submit") {
      if (!txHash) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "txHash is required when submitting transaction",
          },
          { status: 400 }
        );
      }
      const updated = multisigStore.markSubmitted(txId, txHash);
      if (!updated) {
        return NextResponse.json(
          { success: false, data: null, error: "Transaction not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated, error: null });
    }

    if (!publicKey || !signature) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "publicKey and signature are required to sign a transaction",
        },
        { status: 400 }
      );
    }

    const updated = multisigStore.addSignature(txId, publicKey, signature, weight || 1);
    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Transaction not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      error: null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error?.message || "Failed to sign multisig transaction",
      },
      { status: 500 }
    );
  }
}
