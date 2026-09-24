/**
 * POST /api/clips/export
 *
 * Bulk export (Issue #1059). Returns metadata for the selected clips in CSV
 * or JSON so a creator can hand a batch to an editor, an accountant, or their
 * own tooling without clicking through clips one at a time.
 *
 * This exports *metadata*, not video files. Zipping and streaming the media
 * would be a long-running job with its own progress and storage lifecycle —
 * `/api/clips/[id]/download` already handles single files, and the export
 * includes each clip's `videoUrl` so a caller can fetch what it needs.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { clipsStore } from "../clipsStore";
import { bulkExportBodySchema } from "../../schemas/index";
import type { Clip } from "../clipsStore";

/** Columns written to the CSV, in order. */
const EXPORT_COLUMNS = [
  "id",
  "title",
  "status",
  "style",
  "score",
  "scoreKey",
  "duration",
  "resolution",
  "platform",
  "tags",
  "createdAt",
  "videoUrl",
] as const;

/**
 * Escapes one CSV cell.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a single quote. Spreadsheet
 * software treats those as the start of a formula, so a clip titled
 * `=1+1` — or, less innocently, one crafted to pull a remote URL — would
 * execute when the export is opened. Quoting neutralises it while leaving the
 * text readable.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw = Array.isArray(value) ? value.join(" ") : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(clips: Clip[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const rows = clips.map((clip) =>
    EXPORT_COLUMNS.map((col) => csvCell((clip as Record<string, unknown>)[col])).join(","),
  );

  // CRLF and a UTF-8 BOM: Excel misreads a plain LF file as one long row and
  // mangles non-ASCII titles without the BOM.
  return `﻿${[header, ...rows].join("\r\n")}\r\n`;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bulkExportBodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { clipIds, format } = parsed.data;

  // Seed the user's clips so ownership resolves on a first-time request.
  const userClips = clipsStore.getClipsForUser(session.user.id);

  const unowned = clipsStore.findUnownedClipIds(session.user.id, clipIds);
  if (unowned.length > 0) {
    return NextResponse.json(
      { error: "One or more clips do not belong to you", unownedClipIds: unowned },
      { status: 403 },
    );
  }

  const selected = new Set(clipIds);
  // Ordered by the caller's selection rather than store order, so an export
  // matches what the user had highlighted on screen.
  const byId = new Map(userClips.map((c) => [c.id, c]));
  const clips = clipIds
    .map((id) => byId.get(id))
    .filter((c): c is Clip => c !== undefined && selected.has(c.id));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return new NextResponse(toCsv(clips), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clips-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), clips }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="clips-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
