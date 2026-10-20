import { NextRequest, NextResponse } from "next/server";
import { multisigStore } from "../multisigStore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const signer = searchParams.get("signer");

    const transactions = signer
      ? multisigStore.getBySigner(signer)
      : multisigStore.getAll();

    return NextResponse.json({
      success: true,
      data: transactions,
      error: null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error?.message || "Failed to fetch pending multisig transactions",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceAccount, xdr, memo, proposedBy, signers, requiredWeight } = body;

    if (!sourceAccount || !xdr || !proposedBy) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "sourceAccount, xdr, and proposedBy are required.",
        },
        { status: 400 }
      );
    }

    const newTx = multisigStore.create({
      sourceAccount,
      xdr,
      memo: memo || "Multisig Transaction",
      proposedBy,
      signers: Array.isArray(signers) ? signers : [proposedBy],
      requiredWeight: Number(requiredWeight) || 2,
    });

    return NextResponse.json(
      {
        success: true,
        data: newTx,
        error: null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error?.message || "Failed to create multisig transaction proposal",
      },
      { status: 500 }
    );
  }
}
