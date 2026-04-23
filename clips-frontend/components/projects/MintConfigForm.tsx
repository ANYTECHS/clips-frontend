"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface MintFormData {
  collectionName: string;
  description: string;
  creatorRoyalty: string;
  listingPrice: string;
}

interface MintFormErrors {
  collectionName?: string;
  description?: string;
  creatorRoyalty?: string;
  listingPrice?: string;
}

interface MintConfigFormProps {
  onSubmit?: (data: MintFormData) => Promise<void>;
}

function validate(data: MintFormData): MintFormErrors {
  const errors: MintFormErrors = {};

  if (!data.collectionName.trim()) {
    errors.collectionName = "Collection name is required.";
  } else if (data.collectionName.trim().length < 3) {
    errors.collectionName = "Must be at least 3 characters.";
  }

  if (!data.description.trim()) {
    errors.description = "Description is required.";
  } else if (data.description.trim().length > 500) {
    errors.description = "Max 500 characters.";
  }

  const royalty = parseFloat(data.creatorRoyalty);
  if (data.creatorRoyalty === "") {
    errors.creatorRoyalty = "Royalty % is required.";
  } else if (isNaN(royalty) || royalty < 0 || royalty > 50) {
    errors.creatorRoyalty = "Must be between 0 and 50.";
  }

  const price = parseFloat(data.listingPrice);
  if (data.listingPrice === "") {
    errors.listingPrice = "Listing price is required.";
  } else if (isNaN(price) || price <= 0) {
    errors.listingPrice = "Must be a positive number.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {message}
    </p>
  );
}

function getMintErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === "WALLET_REJECTED") return "Transaction was rejected by your wallet. Please try again.";
  if (msg === "NETWORK_ERROR") return "Network error — check your connection and retry.";
  if (msg === "UPLOAD_FAILED") return "Metadata upload failed. The IPFS node may be busy. Please retry.";
  return "Something went wrong while minting. Please try again.";
}

export default function MintConfigForm({ onSubmit }: MintConfigFormProps) {
  const [form, setForm] = useState<MintFormData>({
    collectionName: "",
    description: "",
    creatorRoyalty: "",
    listingPrice: "",
  });
  const [errors, setErrors] = useState<MintFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const inputClass = (field: keyof MintFormErrors) =>
    `w-full bg-[var(--color-input)] border rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-[#4A5D54] focus:outline-none transition-colors ${
      touched[field] && errors[field]
        ? "border-red-500/60 focus:border-red-500"
        : "border-[var(--color-border)] focus:border-brand/50"
    }`;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (touched[name]) {
      setErrors(validate(updated));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors(validate(form));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched = Object.fromEntries(
      Object.keys(form).map((k) => [k, true])
    );
    setTouched(allTouched);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setMintError(null);
    try {
      await onSubmit?.(form);
      setSubmitted(true);
      setRetryCount(0);
    } catch (err) {
      setMintError(getMintErrorMessage(err));
      setRetryCount((c) => c + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-brand" />
        </div>
        <div>
          <p className="text-[16px] font-bold text-white">Ready to Mint</p>
          <p className="text-[13px] text-[#5A6F65] mt-1">
            Your configuration has been saved and is ready for submission.
          </p>
        </div>
        <button
          onClick={() => { setSubmitted(false); setTouched({}); }}
          className="text-[13px] text-brand hover:underline"
        >
          Edit configuration
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-6 sm:p-8 space-y-6"
    >
      <div>
        <h2 className="text-[18px] font-bold text-white">Mint Configuration</h2>
        <p className="text-[13px] text-[#5A6F65] mt-1">
          Set up your NFT collection details before minting.
        </p>
      </div>

      {/* Collection Name */}
      <div>
        <label className="block text-[13px] font-semibold text-[#8e9895] mb-2">
          Collection Name
        </label>
        <input
          type="text"
          name="collectionName"
          value={form.collectionName}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g. ClipCash Genesis"
          className={inputClass("collectionName")}
        />
        <FieldError message={touched.collectionName ? errors.collectionName : undefined} />
      </div>

      {/* Metadata Description */}
      <div>
        <label className="block text-[13px] font-semibold text-[#8e9895] mb-2">
          Metadata Description
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Describe your collection..."
          rows={4}
          className={`${inputClass("description")} resize-none`}
        />
        <div className="flex items-start justify-between mt-1.5">
          <FieldError message={touched.description ? errors.description : undefined} />
          <span className={`text-[11px] ml-auto shrink-0 ${form.description.length > 500 ? "text-red-400" : "text-[#4A5D54]"}`}>
            {form.description.length}/500
          </span>
        </div>
      </div>

      {/* Creator Royalty & Listing Price — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-[13px] font-semibold text-[#8e9895] mb-2">
            Creator Royalty (%)
          </label>
          <div className="relative">
            <input
              type="number"
              name="creatorRoyalty"
              value={form.creatorRoyalty}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="0 – 50"
              min={0}
              max={50}
              step={0.1}
              className={`${inputClass("creatorRoyalty")} pr-10`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#4A5D54] pointer-events-none">
              %
            </span>
          </div>
          <FieldError message={touched.creatorRoyalty ? errors.creatorRoyalty : undefined} />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#8e9895] mb-2">
            Listing Price
          </label>
          <div className="relative">
            <input
              type="number"
              name="listingPrice"
              value={form.listingPrice}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="0.00"
              min={0}
              step={0.001}
              className={`${inputClass("listingPrice")} pr-16`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#4A5D54] pointer-events-none">
              ETH
            </span>
          </div>
          <FieldError message={touched.listingPrice ? errors.listingPrice : undefined} />
        </div>
      </div>

      {/* Error Banner */}
      {mintError && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-red-300">{mintError}</p>
            {retryCount >= 3 && (
              <p className="text-[11px] text-red-400/70 mt-1">
                Still failing? Check your wallet connection or try again later.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)]"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing...
          </>
        ) : mintError ? (
          "Retry"
        ) : (
          "Save & Continue"
        )}
      </button>
    </form>
  );
}
