#!/usr/bin/env node
/**
 * Bundle size budget check.
 *
 * Reads the first-load JavaScript emitted by `next build` and compares its
 * gzipped size against bundle-budget.json. A 5% allowance avoids failing on
 * small build-to-build fluctuations while still catching material regressions.
 *
 * Gzipped rather than raw, because that is what users actually download.
 *
 * Usage:
 *   node scripts/check-bundle-size.js            # fail on budget breaches
 *   node scripts/check-bundle-size.js --report   # print sizes, never fail
 *   node scripts/check-bundle-size.js --update   # record the current build
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const NEXT_DIR = path.join(ROOT, ".next");
const BUDGET_FILE = path.join(ROOT, "bundle-budget.json");
const REPORT_ONLY = process.argv.includes("--report");
const UPDATE = process.argv.includes("--update");

const KB = 1024;
const TOLERANCE = 0.05;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function gzippedSize(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
}

function toKb(bytes) {
  return Math.round((bytes / KB) * 100) / 100;
}

function budgetKb(bytes) {
  return Math.ceil((bytes / KB) * 10) / 10;
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

  if (routes.size === 0) {
    console.error("No route chunks found in the Next.js build manifests.");
    process.exit(2);
  }

  const measurements = [];

  // Shared first-load JS.
  const sharedBytes = sumGzipped([...shared].map(chunkPath));
  measurements.push({
    route: "shared (first load)",
    bytes: sharedBytes,
    budgetKb: budgets.firstLoadShared.maxKb,
  });

  // Per route, shared chunks included — that is what a cold visitor downloads.
  for (const [route, chunks] of [...routes].sort()) {
    const files = new Set([...chunks, ...shared].map(chunkPath));
    const bytes = sumGzipped([...files]);
    const override = routeOverrides[route];
    const limit =
      override && typeof override.maxKb === "number"
        ? override.maxKb
        : budgets.perRoute.maxKb;

    measurements.push({ route, bytes, budgetKb: limit });
  }

  // Every emitted client chunk, counted once.
  const totalBytes = sumGzipped(collectAllClientChunks());
  measurements.push({
    route: "total client JS",
    bytes: totalBytes,
    budgetKb: budgets.totalClient.maxKb,
  });

  if (UPDATE) {
    budgets.firstLoadShared.maxKb = budgetKb(sharedBytes);
    budgets.totalClient.maxKb = budgetKb(totalBytes);
    measurements[0].budgetKb = budgets.firstLoadShared.maxKb;
    measurements[measurements.length - 1].budgetKb = budgets.totalClient.maxKb;
    const updatedOverrides = {};
    for (const measurement of measurements) {
      const { route, bytes } = measurement;
      if (route === "shared (first load)" || route === "total client JS") continue;
      measurement.budgetKb = budgetKb(bytes);
      updatedOverrides[route] = {
        maxKb: measurement.budgetKb,
        reason:
          routeOverrides[route]?.reason ??
          "Initial measured baseline; document intentional size increases in the PR.",
      };
    }
    updatedOverrides.$comment =
      "Per-route first-load baselines. Each intentional increase needs a reason in the PR.";
    config.routeOverrides = updatedOverrides;
    fs.writeFileSync(BUDGET_FILE, `${JSON.stringify(config, null, 2)}\n`);
    console.log("Updated bundle-budget.json from the current build.\n");
  }

  const rows = measurements.map(({ route, bytes, budgetKb: limit }) => {
    const actualKb = toKb(bytes);
    const deltaKb = actualKb - limit;
    return {
      route,
      budget: limit,
      actual: actualKb,
      delta: deltaKb,
      status: bytes > limit * KB * (1 + TOLERANCE) ? "FAIL" : "PASS",
    };
  });

  const routeWidth = Math.max("ROUTE".length, ...rows.map(({ route }) => route.length));
  console.log("\nBundle sizes (gzipped, 5% allowance)\n");
  console.log(
    `  ${"ROUTE".padEnd(routeWidth)}  ${"BUDGET (KB)".padStart(11)}  ${"ACTUAL (KB)".padStart(11)}  ${"DELTA".padStart(8)}  STATUS`,
  );
  for (const row of rows) {
    const delta = `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)} KB`;
    console.log(
      `  ${row.route.padEnd(routeWidth)}  ${row.budget.toFixed(1).padStart(11)}  ${row.actual.toFixed(2).padStart(11)}  ${delta.padStart(8)}  ${row.status}`,
    );
  }
  console.log("");

  const failures = rows.filter(({ status }) => status === "FAIL");
  if (failures.length === 0 || UPDATE) {
    console.log("All bundle budgets met.\n");
    return;
  }

  if (REPORT_ONLY) {
    console.error(`\n${failures.length} bundle budget(s) exceeded by more than 5% (--report only).\n`);
    return;
  }

  console.error(`\n${failures.length} bundle budget(s) exceeded by more than 5%.`);
  console.error("Use --update after an intentional size increase and justify it in the PR.\n");
  process.exit(1);
}

main();
