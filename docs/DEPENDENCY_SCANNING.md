# Automated Dependency Vulnerability Scanning (#1161)

## Overview
ClipCash enforces automated software supply-chain security (Issue #1161) via continuous dependency vulnerability scanning and a formal exception allowlist workflow.

---

## Scanner Architecture

The scanner is implemented in `scripts/dependency-scan.js`:
- Executes `npm audit --json` in a subprocess.
- Parses advisories by severity (`critical`, `high`, `moderate`, `low`, `info`).
- Evaluates advisories against a configurable threshold (`SECURITY_SCAN_THRESHOLD`, default: `critical`).
- Filters out approved exceptions documented in `audit-exceptions.json`.
- Exits with status `0` if all vulnerabilities meet the threshold or are documented exceptions; exits with status `1` and prints actionable details if non-exempt vulnerabilities exceed the threshold.

---

## CI/CD Integration

The scanner is integrated directly into `.github/workflows/ci.yml`:
```yaml
      - name: Dependency vulnerability scan
        run: npm run security:scan
```
This gate ensures that newly introduced dependencies or newly published CVEs above the policy threshold block pull request merges until resolved or formally reviewed.

---

## Exception Management (`audit-exceptions.json`)

When an advisory is discovered that:
1. Cannot be resolved immediately without upstream library releases, and
2. Has been verified to be non-exploitable in ClipCash (e.g., test-only devDependency, dead code path, or mitigated by runtime controls),

it may be temporarily exempted by adding an entry to `audit-exceptions.json`:

```json
{
  "advisoryId": "1100563",
  "package": "example-package",
  "severity": "high",
  "reason": "Used exclusively during unit test execution; not included in production bundle",
  "mitigation": "Isolated to Jest runner",
  "reviewDate": "2026-09-28",
  "expiresAt": "2026-12-28",
  "approvedBy": "security-team"
}
```

### Remediation Runbook
1. **Identify Finding:** Run `npm run security:scan` locally.
2. **Attempt Automated Fix:** Run `npm audit fix`.
3. **Check Upstream Updates:** If automated fix is insufficient, check package releases for minor/patch versions addressing the CVE.
4. **Impact Assessment:** If an upstream fix is unavailable:
   - Determine if the affected package code is reachable in production.
   - If not reachable or mitigated, submit a PR adding an entry to `audit-exceptions.json` with justification and expiration date.
   - If reachable, consider alternative packages or custom patching via `patch-package`.
