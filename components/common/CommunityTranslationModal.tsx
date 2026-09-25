"use client";

import React, { useState, useRef } from "react";
import { X, Download, Upload, Check, AlertCircle, Sparkles, Globe, Loader2 } from "lucide-react";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { sanitize } from "@/app/lib/sanitize";

interface CommunityTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommunityTranslationModal({
  isOpen,
  onClose,
}: CommunityTranslationModalProps) {
  const { t, registerLocale, setLocale } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localeCode, setLocaleCode] = useState("");
  const [languageName, setLanguageName] = useState("");
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const [contributorName, setContributorName] = useState("");
  const [uploadedData, setUploadedData] = useState<Record<string, any> | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/i18n/contribute");
      const json = await res.json();
      if (json.template) {
        const blob = new Blob([JSON.stringify(json.template, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "clips-translation-template.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setValidationError("Failed to download template. Please try again.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    setSubmitSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed !== "object" || parsed === null) {
          throw new Error("File must contain a valid JSON object.");
        }
        setUploadedData(parsed);

        // Auto-populate locale code if matching filename pattern like "ja.json"
        const baseName = file.name.replace(/\.json$/i, "").toLowerCase();
        if (baseName.length === 2 && !localeCode) {
          setLocaleCode(baseName);
        }
      } catch (err: unknown) {
        setValidationError(
          err instanceof Error ? err.message : t("i18n.invalid_json")
        );
        setUploadedData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPreview = () => {
    if (!uploadedData || !localeCode.trim() || !languageName.trim()) {
      setValidationError("Please specify locale code, language name, and upload a valid JSON file.");
      return;
    }

    const code = localeCode.trim().toLowerCase();
    registerLocale(
      {
        value: code,
        label: languageName.trim(),
        nativeName: languageName.trim(),
        direction,
        isCommunity: true,
      },
      uploadedData
    );
    setLocale(code);
    setSubmitSuccess(`Applied preview for ${languageName}! You are now viewing Clips in your language.`);
  };

  const handleSubmitContribution = async () => {
    if (!uploadedData || !localeCode.trim() || !languageName.trim() || !contributorName.trim()) {
      setValidationError("Please fill out all required fields and upload your translations file.");
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    try {
      const res = await fetch("/api/i18n/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: localeCode.trim().toLowerCase(),
          languageName: languageName.trim(),
          direction,
          contributorName: contributorName.trim(),
          translations: uploadedData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit translation.");
      }

      setSubmitSuccess(
        `Thank you ${sanitize(contributorName)}! Your translation for ${sanitize(languageName)} (${json.submission?.coveragePercent ?? 100}% coverage) was successfully registered.`
      );

      // Also register into active app state so contributor can see their work immediately
      handleApplyPreview();
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Error submitting translation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-i18n-title"
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#121316] p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 id="community-i18n-title" className="text-lg font-bold text-white">
                {t("i18n.contribute_title")}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t("i18n.contribute_desc")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {/* Step 1: Download Template */}
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Step 1: Download Base Template</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Get the full English schema with all UI keys to translate.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {/* Step 2: Upload Translated JSON */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">
              Step 2: Upload Your Translated JSON
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-brand/50 bg-white/[0.01] hover:bg-brand/5 transition cursor-pointer text-xs font-medium text-zinc-300"
            >
              <Upload className="w-4 h-4 text-brand" />
              {fileName ? `Loaded: ${fileName}` : "Click to select translated JSON file"}
            </button>
          </div>

          {/* Step 3: Metadata Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Locale Code (e.g. ja, it, hi) *
              </label>
              <input
                type="text"
                value={localeCode}
                onChange={(e) => setLocaleCode(e.target.value)}
                placeholder="e.g. ja"
                maxLength={10}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Language Name (Native / English) *
              </label>
              <input
                type="text"
                value={languageName}
                onChange={(e) => setLanguageName(e.target.value)}
                placeholder="e.g. 日本語 (Japanese)"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Layout Direction
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "ltr" | "rtl")}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
              >
                <option value="ltr" className="bg-[#18191c]">LTR (Left-to-Right)</option>
                <option value="rtl" className="bg-[#18191c]">RTL (Right-to-Left, e.g. Arabic, Hebrew)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Your Contributor Name / Handle *
              </label>
              <input
                type="text"
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                placeholder="e.g. Alex Creator"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Feedback & Alerts */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <Check className="w-4 h-4 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleApplyPreview}
            disabled={!uploadedData || !localeCode || !languageName}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 text-brand" />
            Live Preview in App
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitContribution}
              disabled={isSubmitting || !uploadedData || !localeCode || !languageName || !contributorName}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#00E68A] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,230,138,0.3)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Translation"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
