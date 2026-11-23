import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Issue #1249 — every API route must build JSON responses through
// app/api/apiResponse.ts. This mirrors the ESLint `no-restricted-syntax` rule
// so the guarantee holds even when lint is skipped.

const API_DIR = fileURLToPath(new URL("../../app/api", import.meta.url));

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

const FORBIDDEN = [
  /\b(?:NextResponse|Response)\.json\s*\(/,
  /new\s+(?:NextResponse|Response)\s*\(\s*JSON\.stringify/,
];

describe("API routes", () => {
  const files = routeFiles(API_DIR);

  it("finds route files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(API_DIR, f), f]))(
    "%s does not construct JSON responses directly",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    }
  );
});
