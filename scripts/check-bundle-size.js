#!/usr/bin/env node
/**
 * Bundle size budget check.
 *
 * Reads the client chunks emitted by `next build` and compares their gzipped
 * size against the budgets in bundle-budget.json. Exits non-zero when a budget
 * is exceeded, so a dependency or an accidental barrel import that inflates the
 * bundle fails the build instead of being noticed months later.
 *
 * Gzipped rather than raw, because that is what users actually download.
 *
 * Usage:
 *   node scripts/check-bundle-size.js            # fail on any budget breach
 *   node scripts/check-bundle-size.js --report   # print sizes, never fail
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const NEXT_DIR = path.join(ROOT, ".next");
const BUDGET_FILE = path.join(ROOT, "bundle-budget.json");
const REPORT_ONLY = process.argv.includes("--report");

const KB = 1024;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function gzippedSize(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
}

function toKb(bytes) {
  return Math.round((bytes / KB) * 10) / 10;
}

/** Absolute path for a chunk listed in a build manifest. */
function chunkPath(chunk) {
  return path.join(NEXT_DIR, chunk);
}

/**
 * Collect the client chunks per route.
 *
 * `app-build-manifest.json` is the App Router manifest; `build-manifest.json`
 * covers the Pages Router and the shared runtime. Either may be absent
 * depending on which routers the app uses, so both are optional.
 */
function collectRoutes() {
  const routes = new Map();
  const shared = new Set();

  const appManifestFile = path.join(NEXT_DIR, "app-build-manifest.json");
  if (fs.existsSync(appManifestFile)) {
    const manifest = readJson(appManifestFile);
    for (const [route, chunks] of Object.entries(manifest.pages || {})) {
      routes.set(route, chunks.filter((c) => c.endsWith(".js")));
    }
  }

  const buildManifestFile = path.join(NEXT_DIR, "build-manifest.json");
  if (fs.existsSync(buildManifestFile)) {
    const manifest = readJson(buildManifestFile);
    for (const chunk of manifest.rootMainFiles || []) {
      if (chunk.endsWith(".js")) shared.add(chunk);
    }
    for (const chunk of manifest.polyfillFiles || []) {
      if (chunk.endsWith(".js")) shared.add(chunk);
    }
  }

  return { routes, shared };
}

/** Every emitted client chunk, for the total-size budget. */
function collectAllClientChunks() {
  const staticChunks = path.join(NEXT_DIR, "static", "chunks");
  if (!fs.existsSync(staticChunks)) return [];

  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) found.push(full);
    }
  };
  walk(staticChunks);
  return found;
}

function sumGzipped(files) {
  let total = 0;
  for (const file of files) {
    if (fs.existsSync(file)) total += gzippedSize(file);
  }
  return total;
}

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    console.error("No .next directory found. Run `npm run build` first.");
    process.exit(2);
  }

  const config = readJson(BUDGET_FILE);
  const { budgets, routeOverrides = {} } = config;
  const { routes, shared } = collectRoutes();

  const failures = [];
  const rows = [];

  // Shared first-load JS.
  const sharedBytes = sumGzipped([...shared].map(chunkPath));
  rows.push(["shared (first load)", toKb(sharedBytes), budgets.firstLoadShared.maxKb]);
  if (toKb(sharedBytes) > budgets.firstLoadShared.maxKb) {
    failures.push(
      `shared first-load JS is ${toKb(sharedBytes)} kB, budget ${budgets.firstLoadShared.maxKb} kB`,
    );
  }

  // Per route, shared chunks included — that is what a cold visitor downloads.
  for (const [route, chunks] of [...routes].sort()) {
    const files = new Set([...chunks, ...shared].map(chunkPath));
    const kb = toKb(sumGzipped([...files]));
    const override = routeOverrides[route];
    const limit =
      override && typeof override.maxKb === "number"
        ? override.maxKb
        : budgets.perRoute.maxKb;

    rows.push([route, kb, limit]);
    if (kb > limit) {
      failures.push(`route ${route} is ${kb} kB, budget ${limit} kB`);
    }
  }

  // Everything the build emitted.
  const totalKb = toKb(sumGzipped(collectAllClientChunks()));
  rows.push(["total client JS", totalKb, budgets.totalClient.maxKb]);
  if (totalKb > budgets.totalClient.maxKb) {
    failures.push(`total client JS is ${totalKb} kB, budget ${budgets.totalClient.maxKb} kB`);
  }

  const nameWidth = Math.max(...rows.map(([name]) => name.length));
  console.log("\nBundle sizes (gzipped)\n");
  for (const [name, kb, limit] of rows) {
    const marker = kb > limit ? "FAIL" : "ok  ";
    console.log(`  ${marker}  ${name.padEnd(nameWidth)}  ${String(kb).padStart(7)} kB  / ${limit} kB`);
  }
  console.log("");

  if (failures.length === 0) {
    console.log("All bundle budgets met.\n");
    return;
  }

  for (const failure of failures) {
    console.error(`Bundle budget exceeded: ${failure}`);
  }

  if (REPORT_ONLY) {
    console.error("\n(--report: not failing the build)\n");
    return;
  }

  console.error(
    "\nEither trim the bundle or raise the budget in bundle-budget.json " +
      "with a reason in the PR description.\n",
  );
  process.exit(1);
}

main();
