/**
 * Local ESLint rule: `local/no-commented-out-code`.
 *
 * Flags line comments that are commented-out source code, so dead code is
 * deleted rather than left to rot behind a `//`.
 *
 * Why this is hand-rolled instead of a dependency:
 * `eslint-plugin-no-commented-out-code` was declared in package.json but was
 * unpublished from npm on 2023-07-21, so it could never install. The available
 * third-party replacements are obscure, low-adoption packages, and this repo
 * does not take on that supply-chain surface for a ~40 line heuristic.
 *
 * The detection is deliberately conservative. A comment is only reported when
 * it both *starts* like a statement and *ends* like one. Requiring both halves
 * is what keeps ordinary prose out:
 *
 *   // import { Resend } from "resend";              -> starts `import`, ends `;`  -> reported
 *   // if it does not (legacy jobs) we reset state    -> starts `if`, ends `state` -> ignored
 *   // letting a 1.4 clear the reject threshold.      -> starts prose            -> ignored
 *
 * A single-keyword match is not enough: `if`, `for` and `return` are all common
 * English words, and flagging `// if the user is offline, ...` as dead code
 * would make the rule noise and get it disabled.
 *
 * Report-only by design — no autofix. Deleting a comment automatically on the
 * strength of a regex is not a trade worth making; a wrong delete silently
 * destroys context, and the fix is one keystroke for a human who sees it.
 */

/** Comment bodies beginning with these are wiring, not code. */
const ALLOWED_PREFIX = /^(eslint-|istanbul|@ts-|prettier|TODO|FIXME|NOTE|XXX|HACK|https?:|\/|!)/i;

/** A comment that opens like a statement. */
const CODE_START =
  /^(import|export|const|let|var|function|class|if|else|for|while|do|switch|case|return|await|async|try|catch|finally|throw|new|delete|typeof|yield|super|this)\b/;

/** A comment that closes like a statement. */
const CODE_END = /[;{},)]$/;

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow commented-out code",
      recommended: true,
    },
    schema: [],
    messages: {
      commentedOutCode:
        "Commented-out code. Delete it — git keeps the history, and dead code that stays behind gets rebuilt around.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== "Line") continue;

          const body = comment.value.trim();
          if (!body) continue;
          if (ALLOWED_PREFIX.test(body)) continue;
          if (!CODE_START.test(body)) continue;
          if (!CODE_END.test(body)) continue;

          context.report({ loc: comment.loc, messageId: "commentedOutCode" });
        }
      },
    };
  },
};

module.exports = rule;
