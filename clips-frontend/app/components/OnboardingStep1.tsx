"use client";

import { useState, useCallback } from "react";

const NICHE_OPTIONS = [
  "Gaming",
  "Education",
  "Entertainment",
  "Technology",
  "Fitness & Health",
  "Cooking & Food",
  "Travel",
  "Finance",
  "Music",
  "Comedy",
  "Beauty & Fashion",
  "Sports",
  "Other",
];

interface FormValues {
  fullName: string;
  niche: string;
}

interface FormErrors {
  fullName?: string;
  niche?: string;
}

interface OnboardingStep1Props {
  onContinue?: (values: FormValues) => void;
}

export default function OnboardingStep1({ onContinue }: OnboardingStep1Props) {
  const [values, setValues] = useState<FormValues>({ fullName: "", niche: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ fullName: boolean; niche: boolean }>(
    { fullName: false, niche: false }
  );

  const validate = useCallback((vals: FormValues): FormErrors => {
    const errs: FormErrors = {};
    if (!vals.fullName.trim()) {
      errs.fullName = "Full name is required.";
    }
    if (!vals.niche) {
      errs.niche = "Please select a niche to continue.";
    }
    return errs;
  }, []);

  const isValid = !validate(values).fullName && !validate(values).niche;

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, fullName: e.target.value };
    setValues(next);
    if (touched.fullName) {
      setErrors((prev) => ({ ...prev, ...validate(next) }));
    }
  };

  const handleNicheChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = { ...values, niche: e.target.value };
    setValues(next);
    if (touched.niche) {
      setErrors((prev) => ({ ...prev, ...validate(next) }));
    }
  };

  const handleBlur = (field: "fullName" | "niche") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, ...validate(values) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ fullName: true, niche: true });
    const errs = validate(values);
    setErrors(errs);
    if (!errs.fullName && !errs.niche) {
      onContinue?.(values);
    }
  };

  const fullNameHasError = touched.fullName && !!errors.fullName;
  const nicheHasError = touched.niche && !!errors.niche;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background-tertiary)",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--color-background-primary)",
          borderRadius: "var(--border-radius-xl)",
          border: "0.5px solid var(--color-border-tertiary)",
          padding: "2rem 2rem 2.5rem",
        }}
      >
        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "1.75rem",
          }}
        >
          <StepDot active />
          <StepLine />
          <StepDot />
          <StepLine />
          <StepDot />
        </div>

        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            Step 1 of 3
          </p>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              margin: "0 0 6px",
              lineHeight: 1.3,
            }}
          >
            Tell us about yourself
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            We'll personalise your experience based on your creator type.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="fullName"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                marginBottom: "6px",
              }}
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={values.fullName}
              onChange={handleFullNameChange}
              onBlur={() => handleBlur("fullName")}
              placeholder="e.g. Alex Rivera"
              aria-invalid={fullNameHasError}
              aria-describedby={fullNameHasError ? "fullName-error" : undefined}
              style={{
                display: "block",
                width: "100%",
                height: "40px",
                padding: "0 12px",
                fontSize: "14px",
                color: "var(--color-text-primary)",
                background: "var(--color-background-primary)",
                border: fullNameHasError
                  ? "1.5px solid #E24B4A"
                  : "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                if (!fullNameHasError) {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-primary)";
                  e.currentTarget.style.borderWidth = "1px";
                }
              }}
              onBlurCapture={(e) => {
                if (!fullNameHasError) {
                  e.currentTarget.style.borderColor =
                    "var(--color-border-secondary)";
                  e.currentTarget.style.borderWidth = "0.5px";
                }
              }}
            />
            {fullNameHasError && (
              <p
                id="fullName-error"
                role="alert"
                style={{
                  fontSize: "12px",
                  color: "#E24B4A",
                  margin: "5px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <ErrorIcon />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Creator Type / Niche */}
          <div style={{ marginBottom: "1.75rem" }}>
            <label
              htmlFor="niche"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                marginBottom: "6px",
              }}
            >
              Creator Type / Niche
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="niche"
                value={values.niche}
                onChange={handleNicheChange}
                onBlur={() => handleBlur("niche")}
                aria-invalid={nicheHasError}
                aria-describedby={nicheHasError ? "niche-error" : undefined}
                style={{
                  display: "block",
                  width: "100%",
                  height: "40px",
                  padding: "0 36px 0 12px",
                  fontSize: "14px",
                  color: values.niche
                    ? "var(--color-text-primary)"
                    : "var(--color-text-tertiary)",
                  background: "var(--color-background-primary)",
                  border: nicheHasError
                    ? "1.5px solid #E24B4A"
                    : "0.5px solid var(--color-border-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  outline: "none",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "pointer",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
              >
                <option value="" disabled>
                  Select your niche
                </option>
                {NICHE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {/* Chevron icon */}
              <span
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--color-text-tertiary)",
                  lineHeight: 0,
                }}
              >
                <ChevronIcon />
              </span>
            </div>
            {nicheHasError && (
              <p
                id="niche-error"
                role="alert"
                style={{
                  fontSize: "12px",
                  color: "#E24B4A",
                  margin: "5px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <ErrorIcon />
                {errors.niche}
              </p>
            )}
          </div>

          {/* Continue button */}
          <button
            type="submit"
            disabled={!isValid}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              height: "42px",
              fontSize: "14px",
              fontWeight: 500,
              color: isValid ? "#0A0A0A" : "var(--color-text-tertiary)",
              background: isValid ? "#00FF9D" : "var(--color-background-secondary)",
              border: isValid
                ? "none"
                : "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-md)",
              cursor: isValid ? "pointer" : "not-allowed",
              transition: "background 0.15s, color 0.15s, opacity 0.15s",
              opacity: isValid ? 1 : 0.55,
            }}
            onMouseEnter={(e) => {
              if (isValid) e.currentTarget.style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              if (isValid) e.currentTarget.style.opacity = "1";
            }}
          >
            Continue to step 2
            <ArrowRightIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

function StepDot({ active = false }: { active?: boolean }) {
  return (
    <div
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        flexShrink: 0,
        background: active ? "#00FF9D" : "var(--color-border-secondary)",
        transition: "background 0.2s",
      }}
    />
  );
}

function StepLine() {
  return (
    <div
      style={{
        flex: 1,
        height: "1px",
        background: "var(--color-border-tertiary)",
      }}
    />
  );
}

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 5.25L7 8.75L10.5 5.25"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.917 7h8.166M7.583 4l3.5 3-3.5 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx="6" cy="6" r="5.25" stroke="#E24B4A" strokeWidth="1.2" />
      <path
        d="M6 3.5v3M6 8.25v.25"
        stroke="#E24B4A"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}