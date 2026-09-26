"use client";

/**
 * Creator appeal against a moderation decision (Issue #1063).
 *
 * The form states what was decided and why before asking for a response — an
 * appeal written without knowing the stated reason is guesswork, and produces
 * appeals a reviewer cannot act on.
 */

import { useCallback, useState } from "react";
import { Send } from "lucide-react";
import { CATEGORY_LABELS } from "@/app/lib/moderation/types";
import type { CategoryScores, ModerationCategory } from "@/app/lib/moderation/types";

/** Matches the server's `AppealSchema`, so the client rejects early. */
const MIN_STATEMENT = 20;
const MAX_STATEMENT = 4_000;

export interface AppealFormProps {
  decisionId: string;
  reason: string | null;
  categories: CategoryScores | null;
  onSubmitted?: () => void;
}

export default function AppealForm({
  decisionId,
  reason,
  categories,
  onSubmitted,
}: AppealFormProps) {
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const firedCategories = Object.entries(categories ?? {})
    .filter(([, score]) => typeof score === "number" && score > 0)
    .map(([category]) => CATEGORY_LABELS[category as ModerationCategory])
    .filter(Boolean);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (statement.trim().length < MIN_STATEMENT) {
        setError(`Please write at least ${MIN_STATEMENT} characters.`);
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch(`/api/moderation/${decisionId}/appeal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statement: statement.trim() }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not submit your appeal.");
        }

        setSubmitted(true);
        onSubmitted?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your appeal.");
      } finally {
        setSubmitting(false);
      }
    },
    [decisionId, statement, onSubmitted],
  );

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300"
      >
        <p className="font-semibold text-green-200">Appeal submitted</p>
        <p className="mt-0.5">
          A reviewer will look at this and you&apos;ll be notified of the outcome.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          What was decided
        </p>
        <p className="mt-1 text-sm text-white/80">
          {reason ?? "No reason was recorded for this decision."}
        </p>
        {firedCategories.length > 0 && (
          <p className="mt-2 text-xs text-white/50">
            Policy areas raised: {firedCategories.join(", ")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="appeal-statement"
          className="mb-1.5 block text-sm font-medium text-white/80"
        >
          Why should this be reconsidered?
        </label>
        <textarea
          id="appeal-statement"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          maxLength={MAX_STATEMENT}
          rows={5}
          disabled={submitting}
          aria-describedby="appeal-statement-hint"
          className="w-full rounded-xl border border-white/10 bg-input px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none disabled:opacity-60"
          placeholder="Explain the context a reviewer would need — what the clip shows, and why you think the decision was wrong."
        />
        <p id="appeal-statement-hint" className="mt-1 text-xs text-white/40">
          {statement.trim().length}/{MAX_STATEMENT} · at least {MIN_STATEMENT} characters
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {submitting ? "Submitting…" : "Submit appeal"}
      </button>
    </form>
  );
}
