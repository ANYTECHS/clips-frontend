"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Type,
  Palette,
  Image as ImageIcon,
  Sliders,
  Eye,
  Save,
  Loader2,
} from "lucide-react";
import {
  type BrandKit,
  type BrandComplianceReport,
  validateBrandCompliance,
  getContrastRatio,
  meetsWCAG_AA,
} from "@/app/lib/brandKit";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { sanitize } from "@/app/lib/sanitize";

const FONT_PRESETS = [
  "Inter",
  "Poppins",
  "Outfit",
  "Montserrat",
  "Roboto",
  "Space Grotesk",
  "Plus Jakarta Sans",
];

const PALETTE_PRESETS = [
  {
    name: "Clips Neon",
    primary: "#00E68A",
    secondary: "#7928CA",
    accent: "#FF0080",
    background: "#0B0C0E",
    textColor: "#FFFFFF",
  },
  {
    name: "Cyber Violet",
    primary: "#8B5CF6",
    secondary: "#EC4899",
    accent: "#3B82F6",
    background: "#0F172A",
    textColor: "#F8FAFC",
  },
  {
    name: "Sunset Blaze",
    primary: "#F59E0B",
    secondary: "#EF4444",
    accent: "#10B981",
    background: "#18181B",
    textColor: "#FAFAFA",
  },
  {
    name: "Corporate Luxe",
    primary: "#2563EB",
    secondary: "#1E293B",
    accent: "#FBBF24",
    background: "#09090B",
    textColor: "#FFFFFF",
  },
];

type ManagerTab = "logos" | "colors" | "typography" | "guidelines" | "preview";

export default function BrandKitManager() {
  const { t } = useI18n();

  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [activeKitId, setActiveKitId] = useState<string>("");
  const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
  const [activeTab, setActiveTab] = useState<ManagerTab>("colors");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New kit dialog state
  const [showNewKitModal, setShowNewKitModal] = useState(false);
  const [newKitName, setNewKitName] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Fetch brand kits
  const fetchKits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/brand-kits");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBrandKits(json.data);
        const active = json.activeKit || json.data[0];
        if (active) {
          setActiveKitId(active.id);
          setSelectedKit(active);
        }
      }
    } catch {
      setError("Failed to load brand kits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKits();
  }, [fetchKits]);

  // Sync selectedKit with brandKits list
  const currentKit = selectedKit || brandKits[0];

  // Validation report
  const compliance: BrandComplianceReport = useMemo(() => {
    if (!currentKit) {
      return { compliant: true, issues: [], contrastRatio: 4.5, passesWCAG: true };
    }
    return validateBrandCompliance(currentKit);
  }, [currentKit]);

  // Update selected kit local field
  const handleUpdateField = <K extends keyof BrandKit>(
    field: K,
    value: BrandKit[K]
  ) => {
    if (!currentKit) return;
    const updated = { ...currentKit, [field]: value };
    setSelectedKit(updated);
    setBrandKits((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
  };

  const handleUpdateNested = <
    K extends "palette" | "typography" | "watermark" | "guidelines",
    F extends keyof BrandKit[K]
  >(
    section: K,
    field: F,
    value: BrandKit[K][F]
  ) => {
    if (!currentKit) return;
    const updated = {
      ...currentKit,
      [section]: {
        ...currentKit[section],
        [field]: value,
      },
    };
    setSelectedKit(updated);
    setBrandKits((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
  };

  // Save changes via PUT
  const handleSaveChanges = async () => {
    if (!currentKit) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const res = await fetch("/api/brand-kits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentKit),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save brand kit.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving brand kit");
    } finally {
      setSaving(false);
    }
  };

  // Set kit as active
  const handleSetActive = async (kitId: string) => {
    try {
      const res = await fetch("/api/brand-kits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: kitId, setActive: true }),
      });
      if (res.ok) {
        setActiveKitId(kitId);
        setBrandKits((prev) =>
          prev.map((k) => ({
            ...k,
            isActive: k.id === kitId,
          }))
        );
      }
    } catch {
      setError("Failed to set active brand kit.");
    }
  };

  // Create new brand kit
  const handleCreateKit = async () => {
    if (!newKitName.trim()) return;
    try {
      const res = await fetch("/api/brand-kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKitName.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setBrandKits((prev) => [...prev, json.data]);
        setSelectedKit(json.data);
        setShowNewKitModal(false);
        setNewKitName("");
      }
    } catch {
      setError("Failed to create brand kit.");
    }
  };

  // Delete kit
  const handleDeleteKit = async (kitId: string) => {
    if (brandKits.length <= 1) return;
    try {
      const res = await fetch(`/api/brand-kits?id=${kitId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = brandKits.filter((k) => k.id !== kitId);
        setBrandKits(remaining);
        setSelectedKit(remaining[0] || null);
        if (activeKitId === kitId && remaining[0]) {
          setActiveKitId(remaining[0].id);
        }
      }
    } catch {
      setError("Failed to delete brand kit.");
    }
  };

  // Upload logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentKit) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");

    try {
      const res = await fetch("/api/brand-kits/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.success) {
        handleUpdateNested("watermark", "logoUrl", json.asset.url);
      }
    } catch {
      setError("Failed to upload logo.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!currentKit) {
    return (
      <div className="p-8 text-center bg-[#121316] rounded-2xl border border-white/10">
        <p className="text-white font-semibold">No brand kit found.</p>
        <button
          type="button"
          onClick={() => setShowNewKitModal(true)}
          className="mt-4 px-4 py-2 rounded-xl bg-brand text-black font-bold text-xs"
        >
          {t("brand_kit.create_kit")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Brand Kits Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#121316] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              {t("brand_kit.title")}
              <span className="text-xs font-normal text-zinc-400">
                ({brandKits.length} kits in workspace)
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              {t("brand_kit.subtitle")}
            </p>
          </div>
        </div>

        {/* Brand Kit Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentKit.id}
            onChange={(e) => {
              const kit = brandKits.find((k) => k.id === e.target.value);
              if (kit) setSelectedKit(kit);
            }}
            aria-label={t("brand_kit.active_kit")}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-brand"
          >
            {brandKits.map((kit) => (
              <option key={kit.id} value={kit.id} className="bg-[#18191c]">
                {sanitize(kit.name)} {kit.id === activeKitId ? " (Active)" : ""}
              </option>
            ))}
          </select>

          {currentKit.id !== activeKitId && (
            <button
              type="button"
              onClick={() => handleSetActive(currentKit.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition"
            >
              {t("brand_kit.set_active")}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowNewKitModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-brand text-black hover:brightness-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("brand_kit.create_kit")}</span>
          </button>

          {brandKits.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteKit(currentKit.id)}
              aria-label={t("brand_kit.delete_kit")}
              className="p-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 border border-white/10 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Auto-apply toggle & Compliance Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auto-Apply Card */}
        <div className="p-4 rounded-2xl bg-[#121316] border border-white/10 flex items-center justify-between">
          <div className="pr-4">
            <span className="text-xs font-bold text-white block">
              {t("brand_kit.auto_apply")}
            </span>
            <span className="text-[11px] text-zinc-400">
              {t("brand_kit.auto_apply_desc")}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={currentKit.autoApplyToNewClips}
              onChange={(e) =>
                handleUpdateField("autoApplyToNewClips", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand" />
          </label>
        </div>

        {/* Guidelines Compliance Score Card */}
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 ${
            compliance.compliant
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/20 text-amber-300"
          }`}
        >
          {compliance.compliant ? (
            <ShieldCheck className="w-6 h-6 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">
                {t("brand_kit.compliance_score")}
              </span>
              <span className="text-xs font-mono font-bold">
                Contrast: {compliance.contrastRatio}:1 (
                {compliance.passesWCAG ? "WCAG AA Pass" : "Fail"}
                )
              </span>
            </div>
            <p className="text-[11px] mt-0.5 truncate">
              {compliance.compliant
                ? t("brand_kit.compliance_passed")
                : compliance.issues[0] || t("brand_kit.compliance_issues")}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1">
        {[
          { id: "colors", label: t("brand_kit.colors"), icon: Palette },
          { id: "logos", label: t("brand_kit.logos"), icon: ImageIcon },
          { id: "typography", label: t("brand_kit.fonts"), icon: Type },
          { id: "guidelines", label: t("brand_kit.guidelines"), icon: Sliders },
          { id: "preview", label: "Live Preview Mock", icon: Eye },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ManagerTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                isActive
                  ? "bg-brand/10 text-brand border border-brand/20 font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="p-6 rounded-2xl bg-[#121316] border border-white/10">
        {/* TAB 1: COLOR PALETTE */}
        {activeTab === "colors" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                {t("brand_kit.colors")}
              </h3>
              <p className="text-xs text-zinc-400">
                Define the brand palette used across clip captions, highlights, backgrounds, and watermarks.
              </p>
            </div>

            {/* Presets */}
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                Preset Palettes
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      handleUpdateNested("palette", "primary", preset.primary);
                      handleUpdateNested("palette", "secondary", preset.secondary);
                      handleUpdateNested("palette", "accent", preset.accent);
                      handleUpdateNested("palette", "background", preset.background);
                      handleUpdateNested("palette", "textColor", preset.textColor);
                    }}
                    className="p-3 rounded-xl border border-white/10 hover:border-brand/40 bg-white/5 text-left transition"
                  >
                    <span className="text-xs font-bold text-white block mb-1.5">
                      {preset.name}
                    </span>
                    <div className="flex gap-1.5">
                      {[
                        preset.primary,
                        preset.secondary,
                        preset.accent,
                        preset.background,
                      ].map((col, idx) => (
                        <div
                          key={idx}
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {[
                { key: "primary", label: t("brand_kit.primary_color") },
                { key: "secondary", label: t("brand_kit.secondary_color") },
                { key: "accent", label: t("brand_kit.accent_color") },
                { key: "background", label: t("brand_kit.background_color") },
                { key: "textColor", label: t("brand_kit.text_color") },
              ].map(({ key, label }) => {
                const hexValue = (currentKit.palette as any)[key] || "#FFFFFF";
                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]"
                  >
                    <label className="text-xs font-semibold text-zinc-300 block mb-2">
                      {label}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={hexValue}
                        onChange={(e) =>
                          handleUpdateNested("palette", key as any, e.target.value)
                        }
                        className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={hexValue}
                        onChange={(e) =>
                          handleUpdateNested("palette", key as any, e.target.value)
                        }
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Contrast Ratio Checker */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.01] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Text to Background Contrast Checker
                </span>
                <span className="text-[11px] text-zinc-400">
                  WCAG AA requires a 4.5:1 ratio for readable caption overlays.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold"
                  style={{
                    backgroundColor: currentKit.palette.background,
                    color: currentKit.palette.textColor,
                    border: `1px solid ${currentKit.palette.primary}`,
                  }}
                >
                  Aa Sample Preview
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    compliance.passesWCAG
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {compliance.contrastRatio}:1 (
                  {compliance.passesWCAG ? "PASS" : "FAIL"}
                  )
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LOGOS & WATERMARK */}
        {activeTab === "logos" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                {t("brand_kit.logos")}
              </h3>
              <p className="text-xs text-zinc-400">
                Upload your creator watermark to automatically brand every exported clip.
              </p>
            </div>

            {/* Logo Upload Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-44 rounded-2xl border-2 border-dashed border-white/20 hover:border-brand/50 bg-white/[0.01] hover:bg-brand/5 transition flex flex-col items-center justify-center p-4 text-center cursor-pointer"
                >
                  <Upload className="w-6 h-6 text-brand mb-2" />
                  <span className="text-xs font-bold text-white">
                    {t("brand_kit.upload_logo")}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-1">
                    PNG, SVG, or WebP with transparent background
                  </span>
                </button>
              </div>

              {/* Watermark Configuration */}
              <div className="space-y-4">
                {/* Position */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    {t("brand_kit.watermark_position")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "top-left", label: "Top Left" },
                      { id: "top-right", label: "Top Right" },
                      { id: "bottom-left", label: "Bottom Left" },
                      { id: "bottom-right", label: "Bottom Right" },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() =>
                          handleUpdateNested("watermark", "position", pos.id as any)
                        }
                        className={`p-2.5 rounded-xl border text-xs font-medium transition ${
                          currentKit.watermark.position === pos.id
                            ? "bg-brand/10 border-brand text-brand font-bold"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-300">
                      {t("brand_kit.watermark_opacity")}
                    </span>
                    <span className="font-mono text-white">
                      {Math.round(currentKit.watermark.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={currentKit.watermark.opacity}
                    onChange={(e) =>
                      handleUpdateNested(
                        "watermark",
                        "opacity",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full accent-brand h-1.5 bg-white/10 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TYPOGRAPHY */}
        {activeTab === "typography" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                {t("brand_kit.fonts")}
              </h3>
              <p className="text-xs text-zinc-400">
                Configure primary and secondary fonts for captions and title cards.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Font */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  {t("brand_kit.primary_font")}
                </label>
                <select
                  value={currentKit.typography.primaryFont}
                  onChange={(e) =>
                    handleUpdateNested("typography", "primaryFont", e.target.value)
                  }
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand"
                >
                  {FONT_PRESETS.map((font) => (
                    <option key={font} value={font} className="bg-[#18191c]">
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {/* Secondary Font */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  {t("brand_kit.secondary_font")}
                </label>
                <select
                  value={currentKit.typography.secondaryFont}
                  onChange={(e) =>
                    handleUpdateNested("typography", "secondaryFont", e.target.value)
                  }
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand"
                >
                  {FONT_PRESETS.map((font) => (
                    <option key={font} value={font} className="bg-[#18191c]">
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Minimum Font Size Guideline */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300">
                  {t("brand_kit.min_font_size")}
                </span>
                <span className="font-mono text-white">
                  {currentKit.typography.minFontSizePx}px
                </span>
              </div>
              <input
                type="range"
                min={14}
                max={32}
                value={currentKit.typography.minFontSizePx}
                onChange={(e) =>
                  handleUpdateNested(
                    "typography",
                    "minFontSizePx",
                    parseInt(e.target.value, 10)
                  )
                }
                className="w-full accent-brand h-1.5 bg-white/10 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 4: GUIDELINES & ENFORCEMENT */}
        {activeTab === "guidelines" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                {t("brand_kit.guidelines")}
              </h3>
              <p className="text-xs text-zinc-400">
                Enforce strict rules so editors cannot create non-compliant video exports.
              </p>
            </div>

            <div className="space-y-4">
              {/* Enforce Palette */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {t("brand_kit.disallow_custom_colors")}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Restricts clip editor to only colors defined in this kit.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={currentKit.guidelines.enforcePalette}
                  onChange={(e) =>
                    handleUpdateNested("guidelines", "enforcePalette", e.target.checked)
                  }
                  className="w-4 h-4 accent-brand rounded cursor-pointer"
                />
              </div>

              {/* Require Watermark */}
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {t("brand_kit.require_watermark")}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Disables option to remove watermark on final exports.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={currentKit.guidelines.requireWatermark}
                  onChange={(e) =>
                    handleUpdateNested(
                      "guidelines",
                      "requireWatermark",
                      e.target.checked
                    )
                  }
                  className="w-4 h-4 accent-brand rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LIVE PREVIEW MOCKUP */}
        {activeTab === "preview" && (
          <div className="flex flex-col items-center justify-center p-4">
            <div
              className="relative w-64 aspect-[9/16] rounded-2xl border-2 overflow-hidden shadow-2xl flex flex-col justify-between p-4"
              style={{
                backgroundColor: currentKit.palette.background,
                borderColor: currentKit.palette.primary,
                fontFamily: currentKit.typography.primaryFont,
              }}
            >
              {/* Watermark position demo */}
              <div
                className={`absolute text-xs font-bold px-2 py-0.5 rounded ${
                  currentKit.watermark.position === "top-left"
                    ? "top-3 left-3"
                    : currentKit.watermark.position === "top-right"
                    ? "top-3 right-3"
                    : currentKit.watermark.position === "bottom-left"
                    ? "bottom-3 left-3"
                    : "bottom-3 right-3"
                }`}
                style={{
                  color: currentKit.palette.textColor,
                  backgroundColor: `${currentKit.palette.primary}44`,
                  opacity: currentKit.watermark.opacity,
                }}
              >
                BRAND WATERMARK
              </div>

              {/* Simulated Clip Title */}
              <div className="pt-8">
                <span
                  className="text-xs font-bold uppercase tracking-wider block"
                  style={{ color: currentKit.palette.primary }}
                >
                  Sample Clip
                </span>
                <span
                  className="text-base font-extrabold leading-tight block mt-1"
                  style={{ color: currentKit.palette.textColor }}
                >
                  How I Built A Million Dollar Creator Business
                </span>
              </div>

              {/* Simulated Styled Caption Box */}
              <div
                className="p-3 rounded-xl backdrop-blur-md mb-8 text-center"
                style={{
                  backgroundColor: `${currentKit.palette.secondary}99`,
                  color: currentKit.palette.textColor,
                  fontSize: `${currentKit.typography.minFontSizePx}px`,
                  border: `1px solid ${currentKit.palette.accent}`,
                }}
              >
                &ldquo;Consistency beats talent every single day!&rdquo;
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#121316] border border-white/10">
        <span className="text-xs text-zinc-400">
          Kit Name: <strong className="text-white">{sanitize(currentKit.name)}</strong>
        </span>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" />
              {t("brand_kit.saved_success")}
            </span>
          )}

          {error && <span className="text-xs text-rose-400">{error}</span>}

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#00E68A] hover:brightness-95 transition disabled:opacity-50 shadow-[0_4px_16px_rgba(0,230,138,0.3)]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t("brand_kit.save_changes")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create New Kit Modal */}
      {showNewKitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#121316] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">
              {t("brand_kit.create_kit")}
            </h3>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                {t("brand_kit.kit_name")}
              </label>
              <input
                type="text"
                value={newKitName}
                onChange={(e) => setNewKitName(e.target.value)}
                placeholder="e.g. TikTok Neon"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewKitModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateKit}
                disabled={!newKitName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand text-black hover:brightness-95 disabled:opacity-40"
              >
                Create Kit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
