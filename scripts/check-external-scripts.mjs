#!/usr/bin/env node
/**
 * Issue #1372 — SRI audit for external scripts.
 *
 * Scans the repo for external <script> tags / next/script usages that load
 * from a third-party origin. Any such script MUST include both `integrity`
 * (SRI hash) and `crossorigin` attributes, otherwise the build fails.
 *
 * Current audit result: the app loads NO external scripts (all assets are
 * self-hosted or bundled by Next.js), so this check passes trivially today
 * and guards against regressions.
 *
 * Usage: node scripts/check-external-scripts.mjs   (exit 1 on violations)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];
const EXT = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git"]);

// Matches external script sources: <script src="https://…"> and
// <Script src="https://…"> (next/script).
const SCRIPT_SRC_RE = /<\s*(?:Script|script)\b[^>]*\bsrc=["'`](https?:\/\/[^"'`]+)["'`][^>]*>/gs;
const SRC_ATTR_RE = /\bsrc=["'`](https?:\/\/[^"'`]+)["'`]/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.has(p.slice(p.lastIndexOf(".")))) yield p;
  }
}

const violations = [];
const found = [];

for (const dir of SCAN_DIRS) {
  let base;
  try {
    base = join(ROOT, dir);
    statSync(base);
  } catch {
    continue;
  }
  for (const file of walk(base)) {
    const text = readFileSync(file, "utf8");
    // Only inspect lines/tags that look like script elements.
    for (const m of text.matchAll(SCRIPT_SRC_RE)) {
      const tag = m[0];
      const srcMatch = tag.match(SRC_ATTR_RE);
      const src = srcMatch?.[1] ?? m[1];
      const rel = relative(ROOT, file);
      found.push({ file: rel, src });
      const hasIntegrity = /\bintegrity=["'`][^"'`]+["'`]/.test(tag);
      const hasCrossorigin = /\bcrossorigin(=|\s|>|\/|$)/i.test(tag);
      if (!hasIntegrity || !hasCrossorigin) {
        violations.push({ file: rel, src, missing: [
          ...(hasIntegrity ? [] : ["integrity"]),
          ...(hasCrossorigin ? [] : ["crossorigin"]),
        ].join(" + ") });
      }
    }
  }
}

if (found.length === 0) {
  console.log("SRI audit: no external <script> tags found — nothing to verify.");
  process.exit(0);
}

if (violations.length) {
  console.error("SRI audit FAILED — external scripts missing integrity/crossorigin:");
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.src}  (missing: ${v.missing})`);
  }
  console.error(
    "\nAdd `integrity=\"sha384-…\"` and `crossorigin=\"anonymous\"` to each tag,\n" +
      "or vendor the script locally. SRI hashes can be computed with:\n" +
      "  curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A",
  );
  process.exit(1);
}

console.log(`SRI audit OK — ${found.length} external script(s) all carry integrity + crossorigin.`);
