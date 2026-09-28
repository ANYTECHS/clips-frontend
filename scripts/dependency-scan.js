#!/usr/bin/env node
/**
 * scripts/dependency-scan.js
 *
 * Automated dependency vulnerability scanner for CI and local development (Issue #1161).
 *
 * Usage:
 *   node scripts/dependency-scan.js
 *   node scripts/dependency-scan.js --threshold=high
 *   node scripts/dependency-scan.js --threshold=critical
 */

const { execSync } = require("node:child_process");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const EXCEPTIONS_FILE = join(root, "audit-exceptions.json");

const SEVERITY_LEVELS = ["info", "low", "moderate", "high", "critical"];

function parseArgs() {
  const args = process.argv.slice(2);
  let threshold = process.env.AUDIT_SEVERITY_THRESHOLD || "critical";

  for (const arg of args) {
    if (arg.startsWith("--threshold=")) {
      threshold = arg.split("=")[1].toLowerCase();
    }
  }

  if (!SEVERITY_LEVELS.includes(threshold)) {
    console.error(`Invalid threshold "${threshold}". Must be one of: ${SEVERITY_LEVELS.join(", ")}`);
    process.exit(1);
  }

  return { threshold };
}

function loadExceptions() {
  if (!existsSync(EXCEPTIONS_FILE)) {
    return { exceptions: [] };
  }

  try {
    const content = readFileSync(EXCEPTIONS_FILE, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[Warning] Could not parse ${EXCEPTIONS_FILE}: ${err.message}`);
    return { exceptions: [] };
  }
}

function runNpmAudit() {
  try {
    const stdout = execSync("npm audit --json", {
      cwd: root,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    }).toString();
    return JSON.parse(stdout);
  } catch (error) {
    // npm audit exits with non-zero exit code when vulnerabilities are found
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch (parseError) {
        console.error("Failed to parse npm audit JSON output:", parseError.message);
        process.exit(1);
      }
    }
    console.error("npm audit execution failed:", error.message);
    process.exit(1);
  }
}

function main() {
  const { threshold } = parseArgs();
  const thresholdIndex = SEVERITY_LEVELS.indexOf(threshold);
  const { exceptions = [] } = loadExceptions();

  console.log("=================================================");
  console.log("🛡️  Dependency Vulnerability Scanner (Issue #1161)");
  console.log(`Configured Failure Threshold: "${threshold}" or higher`);
  console.log("=================================================\n");

  const auditReport = runNpmAudit();
  const vulnerabilities = auditReport.vulnerabilities || {};
  const metadata = auditReport.metadata || {};

  const exceptionIds = new Set(
    exceptions
      .filter((e) => !e.expiresAt || new Date(e.expiresAt) > new Date())
      .map((e) => e.id)
  );

  const exceptionPackages = new Set(
    exceptions
      .filter((e) => !e.expiresAt || new Date(e.expiresAt) > new Date())
      .map((e) => e.package)
  );

  const countsBySeverity = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };

  const actionableFindings = [];
  const exemptedFindings = [];

  for (const [pkgName, pkgData] of Object.entries(vulnerabilities)) {
    const isPkgExempt = exceptionPackages.has(pkgName) || exceptionIds.has(pkgName);
    const viaList = Array.isArray(pkgData.via) ? pkgData.via : [];

    // If the entire package is an approved exception (e.g. devDependency test runner)
    if (isPkgExempt) {
      exemptedFindings.push({
        package: pkgName,
        title: `Package-level exemption: ${pkgName}`,
        severity: (pkgData.severity || "low").toLowerCase(),
      });
      continue;
    }

    let packageHasActionableVulnerability = false;

    for (const item of viaList) {
      if (typeof item === "string") {
        if (!exceptionPackages.has(item) && !exceptionIds.has(item)) {
          packageHasActionableVulnerability = true;
        }
      } else if (typeof item === "object" && item.url) {
        const advisoryId = item.url.split("/").pop();
        const severity = (item.severity || pkgData.severity || "low").toLowerCase();

        const finding = {
          package: pkgName,
          title: item.title,
          url: item.url,
          severity,
          advisoryId,
        };

        if (exceptionIds.has(advisoryId) || exceptionPackages.has(item.name)) {
          exemptedFindings.push(finding);
        } else {
          packageHasActionableVulnerability = true;
          actionableFindings.push(finding);
        }
      }
    }

    if (packageHasActionableVulnerability) {
      const pkgSeverity = (pkgData.severity || "low").toLowerCase();
      if (countsBySeverity[pkgSeverity] !== undefined) {
        countsBySeverity[pkgSeverity]++;
      }
    }
  }

  console.log("Vulnerability Summary (Non-Exempt):");
  console.log(`  • Critical: ${countsBySeverity.critical}`);
  console.log(`  • High:     ${countsBySeverity.high}`);
  console.log(`  • Moderate: ${countsBySeverity.moderate}`);
  console.log(`  • Low:      ${countsBySeverity.low}`);
  console.log(`  • Info:     ${countsBySeverity.info}`);
  console.log(`  • Exempt:   ${exemptedFindings.length} documented in audit-exceptions.json\n`);

  let thresholdExceeded = false;
  for (let i = thresholdIndex; i < SEVERITY_LEVELS.length; i++) {
    const level = SEVERITY_LEVELS[i];
    if (countsBySeverity[level] > 0) {
      thresholdExceeded = true;
      break;
    }
  }

  if (thresholdExceeded) {
    console.error(`❌ Security Scan FAILED: Found vulnerabilities at or above "${threshold}" threshold.\n`);
    console.error("Top Actionable Findings:");
    for (const finding of actionableFindings.slice(0, 10)) {
      console.error(`  - [${finding.severity.toUpperCase()}] ${finding.package}: ${finding.title}`);
      console.error(`    Advisory: ${finding.url}`);
    }

    console.error("\nRemediation Steps:");
    console.error("  1. Run `npm update <package>` or `npm audit fix` where safe.");
    console.error("  2. Consult docs/DEPENDENCY_SCANNING.md for breaking change upgrades.");
    console.error("  3. For non-exploitable transitive risks, document an approved exception in audit-exceptions.json.");
    process.exit(1);
  }

  console.log(`✅ Security Scan PASSED: No non-exempt vulnerabilities at or above "${threshold}" threshold.`);
  process.exit(0);
}

main();
