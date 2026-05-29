"use client";

import React from "react";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { Globe } from "lucide-react";
import type { Locale } from "@/app/lib/i18n/types";

interface LocaleSwitcherProps {
  compact?: boolean;
}

export default function LocaleSwitcher({ compact = false }: LocaleSwitcherProps) {
  const { locale, setLocale, locales } = useI18n();

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Globe className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label="Select language"
          className="bg-transparent text-muted hover:text-white text-[11px] font-bold border-none outline-none cursor-pointer appearance-none pr-4"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238e9895' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
            backgroundPosition: "right 0 center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "16px 16px",
          }}
        >
          {locales.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted" aria-hidden="true" />
      <span className="text-[12px] text-muted font-medium">Language:</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Select language">
        {locales.map((l) => (
          <button
            key={l.value}
            onClick={() => setLocale(l.value)}
            role="radio"
            aria-checked={locale === l.value}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              locale === l.value
                ? "bg-brand/10 text-brand border border-brand/30"
                : "bg-surface-hover text-muted border border-border hover:text-white"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
