# Local ESLint rules

Rules maintained in this repo, registered as the `local/` plugin in
[`eslint.config.mjs`](../eslint.config.mjs).

They live here rather than as dependencies because both were written to match
conventions this codebase actually has, and neither has a suitable published
equivalent — see each file's header.

| Rule                                                        | Enforces                                                                                                                          | Docs                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`local/no-commented-out-code`](./no-commented-out-code.js) | Delete dead code instead of commenting it out. Requires a code-shaped start **and** end, so prose beginning "if…" is not flagged. | —                                                   |
| [`local/error-message-style`](./error-message-style.js)     | The user-facing error message standard: punctuation, no system vocabulary, no `err.message` passthrough.                          | [docs/ERROR_HANDLING.md](../docs/ERROR_HANDLING.md) |

## Conventions for a new rule

- **One file, one rule**, CommonJS (`module.exports = rule`). The config is ESM
  but this repo has no `"type": "module"`, so `.js` here is CommonJS and imports
  cleanly from the flat config.
- **Report-only unless the fix is unambiguous.** Neither rule here autofixes.
  Deleting a comment or rewriting a message on the strength of a regex is not a
  trade worth making — a wrong fix is silent, and both are one keystroke for a
  human who can see the context.
- **Document the false positives in the header.** A rule that fires on ordinary
  prose gets disabled, and then it protects nothing. Say which shapes are
  deliberately excluded and why.
- **Scope it in `eslint.config.mjs`**, not inside the rule. Source directories
  only — tests and stories are exempt from the stylistic rules.

## Testing a rule by hand

The quickest check is a scratch file under a directory the config covers:

```bash
cat > app/lib/__scratch_probe.tsx <<'EOF'
"use client";
import { useState } from "react";
export function Probe() {
  const [, setError] = useState<string | null>(null);
  return <button onClick={() => setError("Passwords do not match")}>x</button>;
}
EOF
npx eslint --no-ignore app/lib/__scratch_probe.tsx
rm app/lib/__scratch_probe.tsx
```

`--no-ignore` matters if the filename starts with an underscore. Remove the file
afterwards — the naming convention here would flag it as production source.
