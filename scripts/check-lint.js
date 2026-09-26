/**
 * Ratcheted ESLint gate for CI.
 *
 * ## Why a ratchet rather than `eslint --max-warnings 0`
 *
 * The codebase arrived with ~4,800 findings. Failing the build on any of them
 * would make every PR red regardless of what it touched — a signal nobody can
 * act on, which gets muted and then ignored. That is already the stated
 * reasoning behind the `warn`-not-`error` comments in eslint.config.mjs, and
 * it is the same reasoning as scripts/check-complexity.js, which this mirrors.
 *
 * So: the *current* counts are recorded as a baseline, and CI fails only when a
 * count goes **up**. Fixing things works and is rewarded; breaking things does
 * not. The backlog clears as files get edited rather than in one un-reviewable
 * sweep.
 *
 * ## Per-rule, not one total
 *
 * A single total would let a PR add ten `no-explicit-any`s while deleting ten
 * unused imports and net out to zero. Tracking each rule separately means every
 * regression is caught individually.
 *
 * ## Usage
 *
 *   node scripts/check-lint.js            # CI: fail on any regression
 *   node scripts/check-lint.js --update   # rewrite the baseline (intentional)
 *
 * `npm run lint:baseline` updates. Update it when you have *earned* it — a PR
 * that fixes violations should lower the numbers, and doing so is the point.
 */

const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { ESLint } = require("eslint");

const root = join(__dirname, "..");
const BASELINE_PATH = join(root, ".eslint-baseline.json");

/** Beyond this, the tail is noise — the regressions are what matter. */
const TOP_N = 15;

function keyOf(message) {
  const severity = message.severity === 2 ? "error" : "warning";
  // A fatal parse error has no ruleId. Without this it would be counted under
  // `null` and two unrelated broken files would look like one existing rule.
  const rule = message.ruleId ?? "parse-error";
  return `${severity}:${rule}`;
}

async function collectCounts() {
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(["."]);

  /** @type {Record<string, number>} */
  const counts = {};
  let filesWithFindings = 0;

  for (const result of results) {
    if (result.messages.length === 0) continue;
    filesWithFindings += 1;
    for (const message of result.messages) {
      const key = keyOf(message);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return { counts, filesWithFindings, fileCount: results.length };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch (error) {
    console.error(`Could not parse ${BASELINE_PATH}: ${error.message}`);
    process.exit(1);
  }
}

function formatCounts(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function writeBaseline(sorted, total, filesWithFindings, fileCount) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $comment:
          "ESLint counts per severity:rule. CI fails when any count rises. Regenerate with `npm run lint:baseline` — only after a change that earns it.",
        counts: sorted,
      },
      null,
      2
    )}\n`
  );
  console.log(
    `Wrote baseline: ${total} findings across ${filesWithFindings}/${fileCount} files, ${Object.keys(sorted).length} rules.`
  );
}

/**
 * Compare current counts against the baseline, three ways: rules that got
 * worse, rules that got better, and rules that disappeared entirely.
 */
function partition(sorted, baselineCounts) {
  const regressions = [];
  const improvements = [];

  for (const [rule, count] of Object.entries(sorted)) {
    const was = baselineCounts[rule];
    if (was === undefined) {
      regressions.push({ rule, was: 0, now: count, isNew: true });
    } else if (count > was) {
      regressions.push({ rule, was, now: count, isNew: false });
    } else if (count < was) {
      improvements.push({ rule, was, now: count });
    }
  }

  const fixed = Object.keys(baselineCounts).filter((rule) => !(rule in sorted));
  return { regressions, improvements, fixed };
}

function reportImprovements(improvements, fixed) {
  if (improvements.length > 0) {
    console.log(`\n${improvements.length} rule(s) improved:`);
    for (const { rule, was, now } of improvements.slice(0, TOP_N)) {
      console.log(`  ${rule}: ${was} → ${now} (-${was - now})`);
    }
  }

  if (fixed.length > 0) {
    console.log(`\n${fixed.length} rule(s) fully cleared: ${fixed.join(", ")}`);
  }
}

function reportRegressions(regressions) {
  // Widest gap first — the worst regression is what the reader needs first.
  const byWidestGap = (a, b) => b.now - b.was - (a.now - a.was);

  console.error(`\n${regressions.length} regression(s) against the baseline:`);
  for (const { rule, was, now, isNew } of regressions.sort(byWidestGap)) {
    console.error(`  ${rule}: ${was} → ${now}${isNew ? " (new)" : ` (+${now - was})`}`);
  }
  console.error(
    "\nFix the new findings, or — if they are deliberate and temporary — say so in the PR description. `npm run lint:baseline` accepts them, and reviewers should treat that file's diff as the record of what was accepted."
  );
}

async function main() {
  const update = process.argv.includes("--update");
  const { counts, filesWithFindings, fileCount } = await collectCounts();
  const sorted = formatCounts(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (update) {
    writeBaseline(sorted, total, filesWithFindings, fileCount);
    process.exit(0);
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error(
      `No baseline at ${BASELINE_PATH}. Generate one with \`npm run lint:baseline\` (expected on the first run after this gate is introduced).`
    );
    process.exit(1);
  }

  const { regressions, improvements, fixed } = partition(sorted, baseline.counts);

  console.log(
    `Lint: ${total} findings across ${filesWithFindings}/${fileCount} files, ${Object.keys(sorted).length} rules tracked.`
  );

  reportImprovements(improvements, fixed);

  if (regressions.length === 0) {
    console.log("\nNo regressions. Run `npm run lint:baseline` to lock in any improvements.");
    process.exit(0);
  }

  reportRegressions(regressions);
  process.exit(1);
}

main().catch((error) => {
  console.error(`Lint baseline check failed to run: ${error.stack ?? error.message}`);
  process.exit(1);
});
