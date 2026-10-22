"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Link2, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import { trustlineKey, useTrustline, type Trustline } from "@/app/hooks/useTrustline";
import { sanitize } from "@/app/lib/sanitize";
import { useToast } from "@/components/ToastProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Values captured by the "Add Trustline" form. */
export interface AddTrustlineValues {
  assetCode: string;
  assetIssuer: string;
  limit?: string;
}

/** Props for the presentational trustline list + form. */
export interface TrustlineManagerViewProps {
  trustlines: Trustline[];
  /** True while the list is loading. */
  isListLoading?: boolean;
  /** Error loading the list, shown inline. */
  listError?: string | null;
  /** True while an add operation is in progress. */
  isAdding?: boolean;
  /** `assetCode:issuer` of the trustline currently being removed. */
  removingKey?: string | null;
  /** Current status label for the in-flight operation (e.g. "Signing…"). */
  statusLabel?: string | null;
  /** Opens the add form initially (used by stories). */
  defaultFormOpen?: boolean;
  /** Pre-selects a trustline awaiting removal confirmation (used by stories). */
  defaultConfirmKey?: string | null;
  onAdd: (values: AddTrustlineValues) => void;
  onRemove: (trustline: Trustline) => void;
  onRefresh?: () => void;
}

/** Props for the connected trustline manager. */
export interface TrustlineManagerProps {
  /** Account whose trustlines are managed. */
  publicKey: string | null;
  /** Embedded wallet secret key; when omitted, Freighter signs. */
  secretKey?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSET_CODE_PATTERN = /^[a-zA-Z0-9]{1,12}$/;
const LIMIT_PATTERN = /^\d+(\.\d{1,7})?$/;

/**
 * Validate the "Add Trustline" form.
 *
 * @returns An error message, or null when the values are valid.
 */
export function validateAddTrustline(values: AddTrustlineValues): string | null {
  if (!ASSET_CODE_PATTERN.test(values.assetCode)) {
    return "Asset code must be 1-12 letters or digits.";
  }
  if (!StrKey.isValidEd25519PublicKey(values.assetIssuer)) {
    return "Issuer must be a valid Stellar public key (G…).";
  }
  if (values.limit && !LIMIT_PATTERN.test(values.limit)) {
    return "Limit must be a positive number with up to 7 decimals.";
  }
  return null;
}

function shortKey(key: string): string {
  return key.length > 16 ? `${key.slice(0, 6)}…${key.slice(-6)}` : key;
}

function formatAmount(value: string): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return value;
  // Horizon reports "unlimited" trustlines with the max int64 limit
  if (n >= 922337203685) return "Unlimited";
  return n.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

// ─── Presentational view ──────────────────────────────────────────────────────

/**
 * Trustline list with an add form and per-row remove confirmation.
 * Stateless with respect to the network — wire it up with `TrustlineManager`.
 */
export function TrustlineManagerView({
  trustlines,
  isListLoading = false,
  listError = null,
  isAdding = false,
  removingKey = null,
  statusLabel = null,
  defaultFormOpen = false,
  defaultConfirmKey = null,
  onAdd,
  onRemove,
  onRefresh,
}: TrustlineManagerViewProps) {
  const [formOpen, setFormOpen] = useState(defaultFormOpen);
  const [confirmKey, setConfirmKey] = useState<string | null>(defaultConfirmKey);
  const [values, setValues] = useState<AddTrustlineValues>({
    assetCode: "",
    assetIssuer: "",
    limit: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const busy = isAdding || removingKey !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed: AddTrustlineValues = {
      assetCode: values.assetCode.trim(),
      assetIssuer: values.assetIssuer.trim(),
      limit: values.limit?.trim() || undefined,
    };
    const error = validateAddTrustline(trimmed);
    setFormError(error);
    if (error) return;
    onAdd(trimmed);
  };

  return (
    <section
      aria-labelledby="trustlines-heading"
      className="bg-surface border border-border rounded-[24px] p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="trustlines-heading"
          className="text-[15px] font-extrabold text-white uppercase tracking-wider flex items-center gap-2"
        >
          <Link2 className="w-4 h-4 text-brand" /> Trustlines
        </h2>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isListLoading}
              aria-label="Refresh trustlines"
              className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isListLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-black text-[12px] font-bold hover:bg-brand-hover transition-colors cursor-pointer"
          >
            {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {formOpen ? "Cancel" : "Add Trustline"}
          </button>
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          aria-label="Add trustline"
          className="grid grid-cols-1 md:grid-cols-[120px_1fr_140px_auto] gap-3 items-end bg-white/5 rounded-2xl p-4"
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Asset code
            <input
              value={values.assetCode}
              onChange={(e) => setValues((v) => ({ ...v, assetCode: e.target.value }))}
              placeholder="USDC"
              maxLength={12}
              required
              className="px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-[13px] font-mono normal-case"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Issuer address
            <input
              value={values.assetIssuer}
              onChange={(e) => setValues((v) => ({ ...v, assetIssuer: e.target.value }))}
              placeholder="G…"
              required
              className="px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-[13px] font-mono normal-case"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
            Limit (optional)
            <input
              value={values.limit}
              onChange={(e) => setValues((v) => ({ ...v, limit: e.target.value }))}
              placeholder="Unlimited"
              inputMode="decimal"
              className="px-3 py-2 rounded-lg bg-black/40 border border-border text-white text-[13px] font-mono normal-case"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand text-black text-[13px] font-bold hover:bg-brand-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAdding ? statusLabel ?? "Adding…" : "Add"}
          </button>
          {formError && (
            <p role="alert" className="md:col-span-4 text-error text-[12px]">
              {formError}
            </p>
          )}
        </form>
      )}

      {listError && (
        <div role="alert" className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-error text-[13px]">{sanitize(listError)}</p>
        </div>
      )}

      {isListLoading && trustlines.length === 0 ? (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="w-4 h-4 text-brand animate-spin" />
          <span className="text-muted text-[13px]">Loading trustlines…</span>
        </div>
      ) : trustlines.length === 0 ? (
        <p className="text-muted text-[13px] py-4 text-center">
          No trustlines yet. Add one to hold USDC, NFT assets or custom tokens.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-muted text-[11px] uppercase tracking-wider border-b border-border">
                <th scope="col" className="py-2 pr-4 font-semibold">Asset</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Issuer</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Balance</th>
                <th scope="col" className="py-2 pr-4 font-semibold text-right">Limit</th>
                <th scope="col" className="py-2 font-semibold text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trustlines.map((t) => {
                const key = trustlineKey(t.assetCode, t.assetIssuer);
                const code = sanitize(t.assetCode);
                const isRemoving = removingKey === key;
                const hasBalance = parseFloat(t.balance) > 0;

                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-bold text-white">{code}</td>
                    <td className="py-3 pr-4 font-mono text-muted" title={sanitize(t.assetIssuer)}>
                      {shortKey(sanitize(t.assetIssuer))}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-white">{formatAmount(t.balance)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-muted">{formatAmount(t.limit)}</td>
                    <td className="py-3 text-right">
                      {confirmKey === key ? (
                        <div
                          role="group"
                          aria-label={`Confirm removal of ${code}`}
                          className="inline-flex items-center gap-2"
                        >
                          <span className="text-[12px] text-muted">
                            {hasBalance ? "Balance must be 0 to remove." : `Remove ${code}?`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmKey(null);
                              onRemove(t);
                            }}
                            disabled={busy || hasBalance}
                            className="px-2.5 py-1 rounded-lg bg-error/20 text-error text-[12px] font-bold hover:bg-error/30 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmKey(null)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[12px] font-medium hover:bg-white/20 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmKey(key)}
                          disabled={busy}
                          aria-label={`Remove ${code} trustline`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-muted hover:text-error hover:bg-error/10 text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isRemoving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          {isRemoving ? statusLabel ?? "Removing…" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Connected component ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  building: "Building…",
  signing: "Signing…",
  submitting: "Submitting…",
};

/**
 * Lists, adds and removes trustlines for a Stellar account.
 * Operation errors are surfaced as toasts.
 */
export function TrustlineManager({ publicKey, secretKey: secret }: TrustlineManagerProps) {
  const { addToast } = useToast();
  const secretKey = secret ?? undefined;
  const [action, setAction] = useState<"add" | "remove" | null>(null);

  const {
    status,
    trustlines,
    isListLoading,
    listError,
    pendingKey,
    refresh,
    changeTrustline,
  } = useTrustline({
    publicKey,
    onSuccess: (result) =>
      addToast(
        result.action === "add"
          ? `Trustline for ${sanitize(result.assetCode)} added.`
          : `Trustline for ${sanitize(result.assetCode)} removed.`,
        "success"
      ),
    onError: (error) => addToast(sanitize(error.message), "error"),
  });

  useEffect(() => {
    if (status === "success" || status === "error") setAction(null);
  }, [status]);

  if (!publicKey) return null;

  return (
    <TrustlineManagerView
      trustlines={trustlines}
      isListLoading={isListLoading}
      listError={listError?.message ?? null}
      isAdding={action === "add" && pendingKey !== null}
      removingKey={action === "remove" ? pendingKey : null}
      statusLabel={STATUS_LABELS[status] ?? null}
      onRefresh={refresh}
      onAdd={(values) => {
        setAction("add");
        void changeTrustline({ publicKey, secretKey, action: "add", ...values });
      }}
      onRemove={(t) => {
        setAction("remove");
        void changeTrustline({
          publicKey,
          secretKey,
          action: "remove",
          assetCode: t.assetCode,
          assetIssuer: t.assetIssuer,
        });
      }}
    />
  );
}
