#!/usr/bin/env node
/**
 * scripts/audit-sanitization.js
 *
 * Scans all .tsx files for unsafe usage of dangerouslySetInnerHTML and flags
 * any that are not wrapped with an explicit sanitize() or DOMPurify.sanitize()
 * call, or not using a known-safe static value (like JSON.stringify for JSON-LD).
 *
 * Exit codes:
 *   0 — no violations found
 *   1 — one or more violations found (fails CI)
 *
 * Usage:
 *   node scripts/audit-sanitization.js
 *   node scripts/audit-sanitization.js --verbose
 *
 * Adding a safe-use exemption:
 *   When a dangerouslySetInnerHTML usage is provably safe (e.g. JSON-LD built
 *   from JSON.stringify with no user-controlled keys reflected as markup) you
 *   can annotate the line above with:
 *
 *     // audit-sanitization: safe — <reason>
 *
 *   The script will accept the exemption, print a notice in verbose mode, and
 *   not count the site as a violation.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");

/** Directories that are never scanned. */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "out",
  "coverage",
  ".kilo",
  ".agents",
]);

/** Only scan these extensions. */
const INCLUDED_EXTENSIONS = new Set([".tsx"]);

/**
 * Patterns that indicate a dangerouslySetInnerHTML value is safe.
 *
 * Each entry is tested against the text of the line containing
 * dangerouslySetInnerHTML AND the surrounding ±3 lines.
 */
const SAFE_PATTERNS = [
  // Our own sanitize() utility
  /sanitize\s*\(/,
  // DOMPurify used directly
  /DOMPurify\.sanitize\s*\(/,
  // JSON.stringify is safe — produces a JSON string, not raw HTML
  /JSON\.stringify\s*\(/,
];

const EXEMPTION_COMMENT = /audit-sanitization:\s*safe/i;

const VERBOSE = process.argv.includes("--verbose");

// ─── File walker ──────────────────────────────────────────────────────────────

function* walkFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        yield* walkFiles(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (INCLUDED_EXTENSIONS.has(ext)) {
        yield path.join(dir, entry.name);
      }
    }
  }
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Checks one file for unsafe dangerouslySetInnerHTML usages.
 * Returns an array of violation objects, empty when the file is clean.
 */
function auditFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("dangerouslySetInnerHTML")) continue;

    const lineNumber = i + 1; // 1-indexed for human output

    // Collect context: the line itself plus ±3 surrounding lines for pattern matching.
    const contextStart = Math.max(0, i - 3);
    const contextEnd = Math.min(lines.length - 1, i + 3);
    const contextLines = lines.slice(contextStart, contextEnd + 1);
    const contextText = contextLines.join("\n");

    // Check for an exemption comment on the line above.
    const lineAbove = i > 0 ? lines[i - 1] : "";
    if (EXEMPTION_COMMENT.test(lineAbove)) {
      if (VERBOSE) {
        const rel = path.relative(ROOT, filePath);
        console.log(`  [EXEMPT]  ${rel}:${lineNumber} — ${lineAbove.trim()}`);
      }
      continue;
    }

    // Check whether any safe pattern appears in the surrounding context.
    const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(contextText));
    if (isSafe) {
      if (VERBOSE) {
        const rel = path.relative(ROOT, filePath);
        console.log(`  [SAFE]    ${rel}:${lineNumber} — matches a known-safe pattern`);
      }
      continue;
    }

    violations.push({
      file: path.relative(ROOT, filePath),
      line: lineNumber,
      text: line.trim(),
    });
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning .tsx files for unsafe dangerouslySetInnerHTML usage...\n");

  let totalFiles = 0;
  let totalViolations = 0;

  for (const filePath of walkFiles(ROOT)) {
    totalFiles += 1;
    const violations = auditFile(filePath);
    totalViolations += violations.length;

    if (violations.length > 0) {
      for (const v of violations) {
        console.error(`  ❌ VIOLATION  ${v.file}:${v.line}`);
        console.error(`     ${v.text}`);
        console.error(
          `     dangerouslySetInnerHTML used without sanitize(), DOMPurify.sanitize(), or JSON.stringify().`,
        );
        console.error(
          `     Fix: wrap the value with sanitize() from @/app/lib/sanitize.ts,`,
        );
        console.error(
          `          or add '// audit-sanitization: safe — <reason>' on the line above if provably safe.\n`,
        );
      }
    }
  }

  console.log(`\nScanned ${totalFiles} .tsx file(s).`);

  if (totalViolations === 0) {
    console.log("✅ No unsafe dangerouslySetInnerHTML usages found.\n");
    process.exit(0);
  } else {
    console.error(
      `\n❌ Found ${totalViolations} violation(s). Fix them before merging.\n`,
    );
    process.exit(1);
  }
}

main();
