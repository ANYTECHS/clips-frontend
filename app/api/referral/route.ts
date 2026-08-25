import { NextRequest, NextResponse } from "next/server";

// Mock referral store
const referralStore = new Map<
  string,
  { code: string; link: string; referralCount: number; totalEarned: number }
>();

function getUserId(): string {
  if (typeof window === "undefined") {
    return "server-user";
  }
  const key = "clipcash_user";
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return "anonymous";
    const user = JSON.parse(raw);
    return user?.id || "anonymous";
  } catch {
    return "anonymous";
  }
}

function ensureReferral(userId: string) {
  if (!referralStore.has(userId)) {
    const code = `REF-${userId.slice(0, 6).toUpperCase()}`;
    const link = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/signup?ref=${code}`;
    referralStore.set(userId, { code, link, referralCount: 0, totalEarned: 0 });
  }
  return referralStore.get(userId)!;
}

export async function GET() {
  const userId = getUserId();
  const data = ensureReferral(userId);
  return NextResponse.json({
    code: data.code,
    link: data.link,
    referralCount: data.referralCount,
    totalEarned: data.totalEarned,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "increment") {
    const userId = getUserId();
    const data = ensureReferral(userId);
    data.referralCount += 1;
    const earned = parseFloat((Math.random() * 5 + 1).toFixed(2));
    data.totalEarned = parseFloat((data.totalEarned + earned).toFixed(2));
    return NextResponse.json({
      ok: true,
      referralCount: data.referralCount,
      totalEarned: data.totalEarned,
    });
  }

  return NextResponse.json({ ok: true, ...body });
}