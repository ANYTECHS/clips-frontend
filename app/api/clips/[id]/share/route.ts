import { NextRequest, NextResponse } from "next/server";

const shareStore = new Map<string, { shareId: string; expiresAt: number; revoked: boolean }>();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const days = Number(body?.days || 7);
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const shareId = `${params.id}-${Math.random().toString(36).slice(2, 10)}`;
  shareStore.set(shareId, { shareId, expiresAt, revoked: false });
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return NextResponse.json({ shareId, shareUrl: `${base}/share/${shareId}`, expiresAt: new Date(expiresAt).toISOString() });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const shareId = req.nextUrl.searchParams.get("shareId");
  if (!shareId) return NextResponse.json({ ok: false, error: "Missing shareId" }, { status: 400 });
  const entry = shareStore.get(shareId);
  if (!entry) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  entry.revoked = true;
  return NextResponse.json({ ok: true });
}