import { NextRequest, NextResponse } from "next/server";
import { sanitize } from "@/app/lib/sanitize";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "logo";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file was provided in the upload request." },
        { status: 400 }
      );
    }

    const validTypes = ["logo", "watermark", "font"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid asset type. Supported: logo, watermark, font." },
        { status: 400 }
      );
    }

    const sanitizedFileName = sanitize(file.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const mockUrl = `/uploads/brand/${assetId}-${sanitizedFileName}`;

    return NextResponse.json({
      success: true,
      asset: {
        id: assetId,
        name: sanitizedFileName,
        url: mockUrl,
        type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error processing file upload";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
