// The catalogue imports the logger, which imports @sentry/nextjs. Nothing here
// exercises Sentry, so it is mocked out rather than booted for a string test.
jest.mock("@/app/lib/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  FAILURE_MESSAGES,
  safeErrorMessage,
  signInFailed,
  tooManyAttempts,
  VALIDATION_MESSAGES,
} from "@/app/lib/errorMessages";
import { logger } from "@/app/lib/logger";

/**
 * These tests assert the *standard* in docs/ERROR_HANDLING.md, not the wording.
 *
 * They iterate the catalogue rather than listing messages by hand, so a
 * message added tomorrow is covered without anyone remembering to add a test —
 * which is the only way a standard this easy to drift stays true.
 */

const validationEntries = Object.entries(VALIDATION_MESSAGES);
const failureEntries = Object.entries(FAILURE_MESSAGES);

/** Every message in the catalogue, for the rules that apply to all of them. */
const everyMessage: Array<[string, string]> = [
  ...validationEntries.map(([k, v]) => [`VALIDATION.${k}`, v] as [string, string]),
  ...failureEntries.map(([k, v]) => [`FAILURE.${k}`, v] as [string, string]),
];

describe("error message catalogue", () => {
  it("is not empty", () => {
    // Guards against the iteration below silently passing over zero entries.
    expect(everyMessage.length).toBeGreaterThan(20);
  });

  describe("every message", () => {
    it.each(everyMessage)("%s ends with sentence punctuation", (key, message) => {
      expect(message).toMatch(/[.!?]$/);
    });

    it.each(everyMessage)("%s has no leading or trailing whitespace", (key, message) => {
      expect(message).toBe(message.trim());
    });

    it.each(everyMessage)("%s has no doubled spaces", (key, message) => {
      expect(message).not.toMatch(/ {2,}/);
    });

    it.each(everyMessage)("%s does not use the passive 'Failed to'", (key, message) => {
      // "Failed to load X" reads as the user's failure and is the convention
      // this catalogue replaced.
      expect(message).not.toMatch(/failed to/i);
    });

    it.each(everyMessage)("%s leaks no system detail", (key, message) => {
      // A user cannot act on any of this. It belongs in the log, which
      // safeErrorMessage writes to.
      expect(message).not.toMatch(
        /\b(HTTP|status\s*\d{3}\b|undefined\b|null\b|NaN\b|stack\s*trace|Error:|TypeError)\b/i
      );
    });

    it.each(everyMessage)("%s contains no placeholder left unsubstituted", (key, message) => {
      // tooManyAttempts() is a function precisely so this cannot ship.
      expect(message).not.toMatch(/\$\{|\{\{|\}\}/);
    });
  });

  describe("failure messages", () => {
    /**
     * `unexpected` is the one message that cannot open with "We couldn't":
     * when the failure is genuinely unknown, claiming ownership of it would be
     * a specific claim the code cannot support.
     */
    const OPENER_EXCEPTIONS = new Set(["unexpected"]);

    it.each(failureEntries.filter(([k]) => !OPENER_EXCEPTIONS.has(k)))(
      'FAILURE.%s opens with "We couldn\'t"',
      (key, message) => {
        expect(message).toMatch(/^We couldn't /);
      }
    );

    it("documents why the exceptions are exceptions", () => {
      // If a second exception is ever added, this fails until someone writes
      // down the reason alongside it.
      expect(OPENER_EXCEPTIONS.size).toBe(1);
      expect(FAILURE_MESSAGES).toHaveProperty("unexpected");
    });

    it("places the next step last, after the statement of failure", () => {
      // Where a message offers a next step, that step is the final sentence.
      // Guidance buried mid-message gets skimmed past, and the user is left
      // holding the failure without the action.
      const withNextStep = failureEntries
        .filter(([, message]) => /\bPlease\b/.test(message))
        .map(([, message]) => message);

      // If this ever drops to zero the assertion below stops testing anything.
      expect(withNextStep.length).toBeGreaterThan(5);

      for (const message of withNextStep) {
        expect(message).toMatch(/\.$/);
        // "Please" cannot open the message, or the failure is never stated.
        expect(message.indexOf("Please")).toBeGreaterThan(0);
      }
    });
  });

  describe("validation messages", () => {
    /**
     * Prompts that ask the user for something. All of these must open with
     * "Please" — the standard's rule for this category.
     *
     * The remaining validation messages are not prompts: they report that a
     * submitted value was rejected (`passwordsMustMatch`), that a link is dead
     * (`invalidResetToken`), or that the user is being throttled
     * (`tooManyRequests`). "Please" would be wrong in front of any of them, so
     * they are held only to the rules that apply to every message.
     */
    const PROMPTS = [
      "emailRequired",
      "recoveryPasswordRequired",
      "backupPasswordRequired",
      "backupFileRequired",
      "guardiansRequired",
      "reasonRequired",
    ] as const;

    it.each(PROMPTS)("VALIDATION.%s opens with 'Please'", (key) => {
      expect(VALIDATION_MESSAGES[key]).toMatch(/^Please /);
    });

    it("accounts for every validation message as either a prompt or a rejection", () => {
      const rejections = [
        "passwordsMustMatch",
        "invalidResetToken",
        "tooManyRequests",
        "primaryWalletRequired",
      ];
      expect([...PROMPTS, ...rejections].sort()).toEqual(Object.keys(VALIDATION_MESSAGES).sort());
    });
  });
});

describe("tooManyAttempts", () => {
  it("interpolates the countdown into the message", () => {
    expect(tooManyAttempts("30 seconds")).toBe(
      "Too many attempts. Please wait 30 seconds before trying again."
    );
  });

  it("satisfies the standard it is exempt from by being a function", () => {
    expect(tooManyAttempts("1 minute")).toMatch(/[.!?]$/);
    expect(tooManyAttempts("1 minute")).not.toMatch(/\$\{/);
  });
});

describe("signInFailed", () => {
  it("names the provider, which is the actionable part", () => {
    // With several OAuth buttons on one form, an unqualified "we couldn't sign
    // you in" leaves the user retrying the wrong provider.
    expect(signInFailed("Google")).toBe("We couldn't sign you in with Google. Please try again.");
  });

  it("satisfies the failure standard", () => {
    for (const provider of ["Google", "Apple", "GitHub"]) {
      const message = signInFailed(provider);
      expect(message).toMatch(/^We couldn't /);
      expect(message).toMatch(/[.!?]$/);
      expect(message).toContain(provider);
    }
  });
});

describe("safeErrorMessage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the fallback, not the caught error's message", () => {
    const error = new Error("Request failed with status 502");

    const result = safeErrorMessage(error, FAILURE_MESSAGES.loadWallet);

    expect(result).toBe(FAILURE_MESSAGES.loadWallet);
    // The defect this function exists to remove.
    expect(result).not.toContain("502");
  });

  it("logs the real error so the detail is still recoverable", () => {
    const error = new Error("Request failed with status 502");

    safeErrorMessage(error, FAILURE_MESSAGES.loadWallet, "load wallet");

    expect(logger.error).toHaveBeenCalledWith("[user-facing] load wallet", error);
  });

  it("handles a non-Error throw without rendering it", () => {
    const result = safeErrorMessage("boom", FAILURE_MESSAGES.generic);

    expect(result).toBe(FAILURE_MESSAGES.generic);
  });

  it("works without a context slug", () => {
    safeErrorMessage(new Error("x"), FAILURE_MESSAGES.generic);

    expect(logger.error).toHaveBeenCalledWith("[user-facing] request failed", expect.any(Error));
  });
});
