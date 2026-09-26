/**
 * Local ESLint rule: `local/error-message-style`.
 *
 * Enforces the user-facing error message standard documented in
 * docs/ERROR_HANDLING.md and catalogued in app/lib/errorMessages.ts.
 *
 * The catalogue removes the inconsistency that already existed; this rule is
 * what stops it coming back. Without it the next `setError("Failed to load X")`
 * — no period, no next step — reads as consistent with its neighbours in a
 * diff, and the catalogue quietly stops being the source of truth.
 *
 * ## What it checks
 *
 * Only *inline string literals* passed to a state setter that renders to the
 * user (see CHECKED_CALLEES). Constants from the catalogue are not literals and
 * so are never re-checked — write the message once in the catalogue and every
 * call site inherits it, which is the point.
 *
 * Three checks, each mapped to a rule in the standard:
 *
 * 1. `punctuation` — must end with `.` (the standard's most visible rule, and
 *    the one the codebase violated most: `"Passwords do not match"` next to
 *    `"Failed to upload logo."`).
 * 2. `internalDetail` — must not leak system vocabulary. A status code or the
 *    literal word `null` tells the user nothing they can act on.
 * 3. `errorPassthrough` — must not interpolate a caught error's message. This
 *    is the `err.message || "…"` defect; `safeErrorMessage` is the fix.
 *
 * ## What it deliberately does not check
 *
 * Sentence case, voice, and whether the copy is any good. A rule can verify a
 * period; it cannot verify that "We couldn't load your wallet" is better than
 * "Wallet load failed". Half-enforcing tone with a regex would produce false
 * confidence, so tone is left to review and to the standard's examples.
 */

/** Setters whose string argument is rendered to the user. */
const CHECKED_CALLEES = /^set(Error|ErrorMessage|Err|FormError|StatusMessage)$/;

/** System vocabulary that means nothing to a user. */
const INTERNAL_DETAIL =
  /\b(HTTP|status\s*\d{3}\b|undefined\b|null\b|NaN\b|stack\s*trace|Error:|TypeError|[45]\d{2}\s+(error|response))\b/i;

/** Interpolating a caught error's message into a user-facing string. */
const ERROR_INTERPOLATION = /\$\{[^}]*(err|error|e)(\.|\?\.)?(message|toString)/;

/**
 * The same defect in expression form — `err.message || "…"` and
 * `err instanceof Error ? err.message : "…"`.
 *
 * This is the shape the codebase actually had, fifteen times over, and it is
 * the one most likely to be written again: it reads as defensive at a glance,
 * because the fallback is right there. Matching on `.message` rather than on
 * the whole expression keeps it working when the variable is named `e`, or
 * `cause`, or reached through optional chaining.
 */
const ERROR_MEMBER = /(^|[^.\w])(err|error|cause|e)\s*\??\.\s*(message|toString)\b/;

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the user-facing error message standard",
      recommended: true,
    },
    schema: [],
    messages: {
      punctuation: "User-facing error messages must end with a period. See docs/ERROR_HANDLING.md.",
      internalDetail:
        "This message leaks system detail ({{match}}) that the user cannot act on. State the failure in their terms, or use a constant from app/lib/errorMessages.ts.",
      errorPassthrough:
        "Do not interpolate a caught error's message into user-facing copy — it renders internal text. Use safeErrorMessage(error, FAILURE_MESSAGES.x) so the detail goes to the log instead.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    /** @param {import("estree").Literal | import("estree").TemplateLiteral} node */
    function checkStringArg(node, isTemplate) {
      // The passthrough check has to read the raw source. A template's
      // substituted expressions live in `node.expressions`, NOT in
      // `node.quasis` — so joining the quasis yields `` `Could not load: ` ``
      // and `${err.message}` is nowhere in it. Checking the joined text
      // silently never matched, and the interpolation was reported as a
      // missing period instead: the right line, the wrong reason.
      if (isTemplate && ERROR_INTERPOLATION.test(sourceCode.getText(node))) {
        context.report({ node, messageId: "errorPassthrough" });
        return;
      }

      const literal = isTemplate ? node.quasis.map((q) => q.value.raw).join("") : node.value;
      if (typeof literal !== "string") return;

      // An empty string is a "clear the error" call, not a message.
      const body = literal.trim();
      if (!body) return;

      const detail = literal.match(INTERNAL_DETAIL);
      if (detail) {
        context.report({ node, messageId: "internalDetail", data: { match: detail[0] } });
        return;
      }

      if (!/[.!?]$/.test(body)) {
        context.report({ node, messageId: "punctuation" });
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        if (!CHECKED_CALLEES.test(node.callee.name)) return;

        const [first] = node.arguments;
        if (!first) return;

        if (first.type === "Literal" && typeof first.value === "string") {
          checkStringArg(first, false);
        } else if (first.type === "TemplateLiteral") {
          checkStringArg(first, true);
        } else if (first.type === "LogicalExpression" || first.type === "ConditionalExpression") {
          // `err.message || "…"` / `err instanceof Error ? err.message : "…"`.
          // The rendered text depends on what the Error carried, so this is
          // the passthrough defect wearing a fallback.
          if (ERROR_MEMBER.test(sourceCode.getText(first))) {
            context.report({ node: first, messageId: "errorPassthrough" });
          }
        }
      },
    };
  },
};

module.exports = rule;
