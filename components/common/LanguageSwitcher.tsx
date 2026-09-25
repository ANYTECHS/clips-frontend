"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Globe, Check, ChevronDown, Sparkles, Languages } from "lucide-react";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import CommunityTranslationModal from "./CommunityTranslationModal";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageSwitcher({
  compact = false,
  className = "",
}: LanguageSwitcherProps) {
  const { locale, setLocale, locales, isRTL, detectedLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    []
  );

  const currentConfig = locales.find((l) => l.value === locale) || locales[0];

  return (
    <>
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={t("i18n.switch_language")}
          className={`group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            compact ? "p-2" : ""
          }`}
        >
          <Globe className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
          {!compact && (
            <span className="flex items-center gap-1.5">
              <span>{currentConfig?.flag}</span>
              <span>{currentConfig?.nativeName || currentConfig?.label}</span>
              {currentConfig?.direction === "rtl" && (
                <span className="rounded bg-brand/20 px-1 py-0.2 text-[9px] font-bold text-brand uppercase">
                  RTL
                </span>
              )}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={t("i18n.switch_language")}
            className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#121316] p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {t("i18n.switch_language")}
              </span>
              {detectedLocale && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                  Auto: {detectedLocale}
                </span>
              )}
            </div>

            {/* Locales list */}
            <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
              {locales.map((item) => {
                const isSelected = item.value === locale;
                return (
                  <button
                    key={item.value}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => {
                      setLocale(item.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? "bg-brand/10 text-brand font-bold border border-brand/20"
                        : "text-zinc-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{item.flag || "🌐"}</span>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">
                            {item.nativeName || item.label}
                          </span>
                          {item.direction === "rtl" && (
                            <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-semibold text-zinc-300">
                              RTL
                            </span>
                          )}
                          {item.isCommunity && (
                            <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[9px] font-semibold text-purple-300">
                              Community
                            </span>
                          )}
                        </div>
                        {item.nativeName && item.nativeName !== item.label && (
                          <span className="text-[10px] text-zinc-500 block">
                            {item.label}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Community Contribution Trigger */}
            <div className="pt-2 mt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowContributeModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-brand/10 hover:border-brand/30 border border-transparent transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>{t("i18n.contribute")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CommunityTranslationModal
        isOpen={showContributeModal}
        onClose={() => setShowContributeModal(false)}
      />
    </>
  );
}
