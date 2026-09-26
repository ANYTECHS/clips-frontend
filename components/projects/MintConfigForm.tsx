"use client";

import React, { useMemo, useState } from "react";

import { FAILURE_MESSAGES, safeErrorMessage } from "@/app/lib/errorMessages";
import { calculateStellarMintCost, formatXlm } from "@/app/lib/mintUtils";

interface MintConfigFormProps {
  onSubmit: (data: {
    collectionName: string;
    description: string;
    creatorRoyalty: string;
    listingPrice: string;
  }) => Promise<unknown>;
}

type FormField =
  | "collectionName"
  | "description"
  | "creatorRoyalty"
  | "listingPrice";

type FormValues = Record<FormField, string>;
type FormErrors = Partial<Record<FormField, string>>;

const INITIAL_VALUES: FormValues = {
  collectionName: "",
  description: "",
  creatorRoyalty: "",
  listingPrice: "",
};

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  const collectionName = values.collectionName.trim();
  const description = values.description.trim();
  const royaltyText = values.creatorRoyalty.trim();
  const listingPriceText = values.listingPrice.trim();

  if (!collectionName) {
    errors.collectionName = "Collection name is required.";
  } else if (collectionName.length < 3) {
    errors.collectionName = "Must be at least 3 characters.";
  } else if (collectionName.length > 100) {
    errors.collectionName = "Must be fewer than 100 characters.";
  }

  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length < 10) {
    errors.description = "Description must be at least 10 characters.";
  } else if (description.length > 2_000) {
    errors.description = "Description must be fewer than 2,000 characters.";
  }

  if (!royaltyText) {
    errors.creatorRoyalty = "Royalty percentage is required.";
  } else {
    const royalty = Number(royaltyText);

    if (!Number.isFinite(royalty)) {
      errors.creatorRoyalty = "Royalty must be a valid number.";
    } else if (royalty < 0 || royalty > 50) {
      errors.creatorRoyalty = "Royalty must be between 0 and 50.";
    }
  }

  if (!listingPriceText) {
    errors.listingPrice = "Listing price is required.";
  } else {
    const price = Number(listingPriceText);

    if (!Number.isFinite(price)) {
      errors.listingPrice = "Listing price must be a valid number.";
    } else if (price < 0) {
      errors.listingPrice = "Listing price cannot be negative.";
    }
  }

  return errors;
}

export default function MintConfigForm({ onSubmit }: MintConfigFormProps) {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<FormField, boolean>>
  >({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clipCount = 1;
  const { totalCost } = calculateStellarMintCost(clipCount);

  const visibleErrors = useMemo(() => {
    const result: FormErrors = {};

    for (const field of Object.keys(errors) as FormField[]) {
      if (submitAttempted || touched[field]) {
        result[field] = errors[field];
      }
    }

    return result;
  }, [errors, submitAttempted, touched]);

  const updateField = (field: FormField, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setServerError(null);

    if (submitAttempted || touched[field]) {
      const nextValues = {
        ...values,
        [field]: value,
      };

      setErrors(validateForm(nextValues));
    }
  };

  const handleBlur = (field: FormField) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }));

    setErrors(validateForm(values));
  };

  const focusFirstInvalidField = (formErrors: FormErrors) => {
    const firstInvalidField = (
      ["collectionName", "description", "creatorRoyalty", "listingPrice"] as FormField[]
    ).find((field) => formErrors[field]);

    if (!firstInvalidField) return;

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)
        ?.focus();
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitAttempted(true);
    setServerError(null);

    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        collectionName: values.collectionName.trim(),
        description: values.description.trim(),
        creatorRoyalty: values.creatorRoyalty.trim(),
        listingPrice: values.listingPrice.trim(),
      });
    } catch (error) {
      // The caught error goes to the logger with its stack; the user gets the
      // catalogue string. Interpolating `error.message` here would leak system
      // vocabulary into the UI and offer no next step.
      setServerError(
        safeErrorMessage(error, FAILURE_MESSAGES.unexpected, "mint config"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (field: FormField) =>
    `w-full rounded-xl border px-4 py-2 text-white outline-none transition-colors ${
      visibleErrors[field]
        ? "border-red-500 bg-red-500/5 focus:border-red-400"
        : "border-white/10 bg-input focus:border-brand/50"
    }`;

  const renderError = (field: FormField) => {
    const message = visibleErrors[field];

    if (!message) return null;

    return (
      <p id={`${field}-error`} role="alert" className="text-xs text-red-400">
        {message}
      </p>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {serverError}
        </div>
      )}

      <div className="space-y-1">
        <label
          htmlFor="collectionName"
          className="text-sm font-medium text-white/80"
        >
          Collection Name
        </label>

        <input
          id="collectionName"
          name="collectionName"
          type="text"
          value={values.collectionName}
          onChange={(event) =>
            updateField("collectionName", event.target.value)
          }
          onBlur={() => handleBlur("collectionName")}
          aria-invalid={Boolean(visibleErrors.collectionName)}
          aria-describedby={
            visibleErrors.collectionName ? "collectionName-error" : undefined
          }
          className={fieldClass("collectionName")}
          placeholder="e.g. My Awesome Clips"
        />

        {renderError("collectionName")}
      </div>

      <div className="space-y-1">
        <label
          htmlFor="description"
          className="text-sm font-medium text-white/80"
        >
          Description
        </label>

        <textarea
          id="description"
          name="description"
          value={values.description}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          onBlur={() => handleBlur("description")}
          aria-invalid={Boolean(visibleErrors.description)}
          aria-describedby={
            visibleErrors.description ? "description-error" : undefined
          }
          className={fieldClass("description")}
          placeholder="Describe your collection..."
          rows={3}
        />

        {renderError("description")}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="creatorRoyalty"
            className="text-sm font-medium text-white/80"
          >
            Creator Royalty (%)
          </label>

          <input
            id="creatorRoyalty"
            name="creatorRoyalty"
            type="number"
            min="0"
            max="50"
            step="0.01"
            value={values.creatorRoyalty}
            onChange={(event) =>
              updateField("creatorRoyalty", event.target.value)
            }
            onBlur={() => handleBlur("creatorRoyalty")}
            aria-invalid={Boolean(visibleErrors.creatorRoyalty)}
            aria-describedby={
              visibleErrors.creatorRoyalty
                ? "creatorRoyalty-error"
                : undefined
            }
            className={fieldClass("creatorRoyalty")}
            placeholder="e.g. 10"
          />

          {renderError("creatorRoyalty")}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="listingPrice"
            className="text-sm font-medium text-white/80"
          >
            Listing Price
          </label>

          <input
            id="listingPrice"
            name="listingPrice"
            type="number"
            min="0"
            step="0.01"
            value={values.listingPrice}
            onChange={(event) =>
              updateField("listingPrice", event.target.value)
            }
            onBlur={() => handleBlur("listingPrice")}
            aria-invalid={Boolean(visibleErrors.listingPrice)}
            aria-describedby={
              visibleErrors.listingPrice ? "listingPrice-error" : undefined
            }
            className={fieldClass("listingPrice")}
            placeholder="e.g. 0.5"
          />

          {renderError("listingPrice")}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Estimated Mint Fee</span>
          <span className="font-mono font-bold text-brand">
            {formatXlm(totalCost)}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand py-3 font-bold text-black transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Minting..." : "Mint Collection"}
      </button>
    </form>
  );
}
