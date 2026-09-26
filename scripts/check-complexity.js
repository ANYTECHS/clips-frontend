const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const roots = ["app", "components", "hooks"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const maxComplexity = Number(process.env.COMPLEXITY_MAX ?? 12);
const maxFunctionLines = Number(process.env.COMPLEXITY_MAX_LINES ?? 80);
const strict = process.env.COMPLEXITY_STRICT === "true";
const baselineFindings = Number(process.env.COMPLEXITY_BASELINE ?? Infinity);
const findings = [];

function extensionOf(file) {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return extensions.has(extensionOf(entry.name)) ? [path] : [];
  });
}

function scoreLine(line) {
  const matches = line.match(/\b(if|for|while|case|catch|&&|\|\||\?)\b/g);
  return matches ? matches.length : 0;
}

function analyzeFile(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let current = null;

  lines.forEach((line, index) => {
    const startsFunction =
      /\b(function|async function)\b/.test(line) || /=>\s*\{/.test(line) || /\)\s*\{/.test(line);

    if (!current && startsFunction) {
      current = { start: index + 1, complexity: 1, braceDepth: 0 };
    }

    if (!current) return;

    current.complexity += scoreLine(line);
    current.braceDepth += (line.match(/\{/g) ?? []).length;
    current.braceDepth -= (line.match(/\}/g) ?? []).length;

    if (current.braceDepth <= 0 && index + 1 > current.start) {
      const length = index + 1 - current.start + 1;
      if (current.complexity > maxComplexity || length > maxFunctionLines) {
        findings.push({
          file,
          line: current.start,
          complexity: current.complexity,
          length,
        });
      }
      current = null;
    }
  });
}

roots.flatMap(walk).forEach(analyzeFile);

const topFindings = findings
  .sort((a, b) => b.complexity - a.complexity || b.length - a.length)
  .slice(0, 20);

if (topFindings.length === 0) {
  console.log(
    `Complexity check passed. Thresholds: complexity ${maxComplexity}, lines ${maxFunctionLines}.`
  );
  process.exit(0);
}

console.warn(
  `Complexity findings: ${findings.length}. Thresholds: complexity ${maxComplexity}, lines ${maxFunctionLines}.`
);
for (const finding of topFindings) {
  console.warn(
    `${finding.file}:${finding.line} complexity=${finding.complexity} lines=${finding.length}`
  );
}

const exceededBaseline = Number.isFinite(baselineFindings) && findings.length > baselineFindings;
if (exceededBaseline) {
  console.error(`Complexity baseline exceeded: ${findings.length} > ${baselineFindings}.`);
}
if (strict || exceededBaseline) {
  process.exit(1);
}
