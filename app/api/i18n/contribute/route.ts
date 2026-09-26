import { NextRequest, NextResponse } from "next/server";
import { getBaseTranslationSchema } from "@/app/lib/i18n/translations";
import { sanitize } from "@/app/lib/sanitize";

// In-memory registry for community submissions
interface ContributedLocaleEntry {
  id: string;
  locale: string;
  languageName: string;
  direction: "ltr" | "rtl";
  contributorName: string;
  contributorEmail?: string;
  notes?: string;
  translations: Record<string, any>;
  submittedAt: string;
  coveragePercent: number;
}

const communitySubmissions: ContributedLocaleEntry[] = [];

function countKeys(obj: Record<string, any>): number {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

function calculateCoverage(
  base: Record<string, any>,
  target: Record<string, any>
): { total: number; matching: number; missing: string[] } {
  let total = 0;
  let matching = 0;
  const missing: string[] = [];

  function compare(b: Record<string, any>, t: Record<string, any>, prefix = "") {
    for (const key of Object.keys(b)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof b[key] === "object" && b[key] !== null) {
        compare(b[key], (t && typeof t[key] === "object") ? t[key] : {}, fullPath);
      } else {
        total++;
        if (t && t[key] && typeof t[key] === "string" && t[key].trim().length > 0) {
          matching++;
        } else {
          missing.push(fullPath);
        }
      }
    }
  }

  compare(base, target);
  return { total, matching, missing };
}

export async function GET() {
  const schema = getBaseTranslationSchema();
  return NextResponse.json({
    success: true,
    totalBaseKeys: countKeys(schema),
    template: schema,
    submissionsCount: communitySubmissions.length,
    submissions: communitySubmissions.map((s) => ({
      id: s.id,
      locale: s.locale,
      languageName: s.languageName,
      direction: s.direction,
      contributorName: s.contributorName,
      submittedAt: s.submittedAt,
      coveragePercent: s.coveragePercent,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      locale,
      languageName,
      direction = "ltr",
      contributorName,
      contributorEmail,
      translations,
      notes,
    } = body;

    if (!locale || typeof locale !== "string") {
      return NextResponse.json(
        { success: false, error: "Locale code (e.g. 'de', 'ja', 'it') is required." },
        { status: 400 }
      );
    }

    if (!languageName || typeof languageName !== "string") {
      return NextResponse.json(
        { success: false, error: "Language name is required." },
        { status: 400 }
      );
    }

    if (!contributorName || typeof contributorName !== "string") {
      return NextResponse.json(
        { success: false, error: "Contributor name is required." },
        { status: 400 }
      );
    }

    if (!translations || typeof translations !== "object") {
      return NextResponse.json(
        { success: false, error: "A valid translations object is required." },
        { status: 400 }
      );
    }

    const baseSchema = getBaseTranslationSchema();
    const { total, matching, missing } = calculateCoverage(baseSchema, translations);
    const coveragePercent = total > 0 ? Math.round((matching / total) * 100) : 0;

    const submission: ContributedLocaleEntry = {
      id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      locale: sanitize(locale.toLowerCase().trim()),
      languageName: sanitize(languageName.trim()),
      direction: direction === "rtl" ? "rtl" : "ltr",
      contributorName: sanitize(contributorName.trim()),
      contributorEmail: contributorEmail ? sanitize(String(contributorEmail).trim()) : undefined,
      notes: notes ? sanitize(String(notes).trim()) : undefined,
      translations,
      submittedAt: new Date().toISOString(),
      coveragePercent,
    };

    communitySubmissions.push(submission);

    return NextResponse.json({
      success: true,
      message: "Community translation registered successfully!",
      submission: {
        id: submission.id,
        locale: submission.locale,
        languageName: submission.languageName,
        direction: submission.direction,
        coveragePercent,
        totalKeys: total,
        matchingKeys: matching,
        missingKeysCount: missing.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
