#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const reportPath = path.join(process.cwd(), "reports/mutation/mutation.json");
const baselinePath = path.join(process.cwd(), "mutation-baseline.json");

if (!fs.existsSync(reportPath)) {
  console.error(`Stryker JSON report not found: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const score = report.mutationScore ?? report.metrics?.mutationScore ?? report.score;
if (typeof score !== "number" || !Number.isFinite(score)) {
  console.error("Stryker JSON report does not contain a numeric mutation score.");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const record = {
  score: Number(score.toFixed(2)),
  recordedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? "local",
};
const historyPath = path.join(process.cwd(), "reports/mutation/baseline-history.json");
const history = fs.existsSync(historyPath)
  ? JSON.parse(fs.readFileSync(historyPath, "utf8"))
  : [];
history.push(record);
fs.mkdirSync(path.dirname(historyPath), { recursive: true });
fs.writeFileSync(historyPath, `${JSON.stringify(history.slice(-100), null, 2)}\n`);

baseline.baselineScore = record.score;
baseline.recordedAt = record.recordedAt;
fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Recorded mutation baseline: ${record.score}% at ${record.commit}`);
