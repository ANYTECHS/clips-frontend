"use client";

/**
 * Manual review queue (Issue #1063).
 *
 * Shows what the automated check was unsure about and lets a reviewer decide.
 * Ordered oldest-first: a queue sorted newest-first starves its tail, and the
 * oldest item is the creator who has been waiting longest.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import ModerationStatusBadge from "./ModerationStatusBadge";
import { CATEGORY_LABELS } from "@/app/lib/moderation/types";
import type {
  ModerationCategory,
  ModerationDecision,
  ModerationStatus,
} from "@/app/lib/moderation/types";

interface QueueDecision extends ModerationDecision {
  appeals?: { id: string; status: string; statement: string }[];
}

function CategoryScores({ categories }: { categories: ModerationDecision["categories"] }) {
  const entries = Object.entries(categories ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return <p className="text-xs text-white/40">No category scores recorded.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map(([category, score]) => (
        <li
          key={category}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
        >
          {CATEGORY_LABELS[category as ModerationCategory] ?? category}{" "}
          <span className="font-mono text-white/50">{score.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ModerationReviewQueue() {
  const [decisions, setDecisions] = useState<QueueDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/moderation?status=flagged&limit=50");
      if (!response.ok) throw new Error("Could not load the review queue.");
      const body = await response.json();
      const rows: QueueDecision[] = Array.isArray(body.decisions) ? body.decisions : [];
      // Oldest first — see the note at the top of the file.
      setDecisions(
        [...rows].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (decisionId: string, status: Extract<ModerationStatus, "approved" | "rejected">) => {
      const reason = reasons[decisionId]?.trim();
      if (!reason) {
        setError("A reason is required — the creator is shown what you write.");
        return;
      }

      setPendingId(decisionId);
      setError(null);
      try {
        const response = await fetch(`/api/moderation/${decisionId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not record the decision.");
        }
        // Drop it locally rather than refetching: the reviewer's next item
        // should appear immediately, not after a round trip.
        setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not record the decision.");
      } finally {
        setPendingId(null);
      }
    },
    [reasons],
  );

  return (
    <section className="space-y-4" aria-labelledby="review-queue-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="review-queue-heading" className="text-xl font-bold text-white">
          Review queue
          <span className="ml-2 text-sm font-medium text-white/40">
            {decisions.length} waiting
          </span>
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh the review queue"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-surface text-white/70 transition-colors hover:text-white disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && decisions.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/50">
          Nothing waiting for review.
        </p>
      )}

      <ul className="space-y-3">
        {decisions.map((decision) => (
          <li
            key={decision.id}
            className="space-y-3 rounded-2xl border border-white/10 bg-surface/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-white">
                  {decision.contentType} · {decision.contentId}
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  {new Date(decision.createdAt).toLocaleString()} ·{" "}
                  {decision.provider ?? "no provider"}
                </p>
              </div>
              <ModerationStatusBadge status={decision.status} />
            </div>

            {decision.reason && (
              <p className="text-sm text-white/70">{decision.reason}</p>
            )}

            <CategoryScores categories={decision.categories} />

            {/* An open appeal is the creator's side of the argument, and a
                reviewer deciding without reading it is deciding blind. */}
            {decision.appeals
              ?.filter((appeal) => appeal.status === "open")
              .map((appeal) => (
                <blockquote
                  key={appeal.id}
                  className="rounded-xl border-l-2 border-brand/50 bg-white/5 px-4 py-2.5 text-sm text-white/70"
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">
                    Creator&apos;s appeal
                  </p>
                  {appeal.statement}
                </blockquote>
              ))}

            <div className="space-y-2">
              <label htmlFor={`reason-${decision.id}`} className="sr-only">
                Reason for the decision on {decision.contentId}
              </label>
              <input
                id={`reason-${decision.id}`}
                value={reasons[decision.id] ?? ""}
                onChange={(e) =>
                  setReasons((prev) => ({ ...prev, [decision.id]: e.target.value }))
                }
                placeholder="Reason — shown to the creator"
                className="w-full rounded-xl border border-white/10 bg-input px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void decide(decision.id, "approved")}
                  disabled={pendingId === decision.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-500/15 px-4 text-sm font-semibold text-green-300 transition-colors hover:bg-green-500/25 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void decide(decision.id, "rejected")}
                  disabled={pendingId === decision.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-500/15 px-4 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
