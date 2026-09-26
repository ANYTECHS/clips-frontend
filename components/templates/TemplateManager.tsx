"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Copy,
  History,
  Loader2,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";
import { TRANSFORM_STYLES } from "@/app/lib/transformStyles";

type AspectRatio = "9:16" | "1:1" | "16:9";

interface TemplateSettings {
  aspectRatio: AspectRatio;
  durationSeconds: number;
  style: string;
  transformStyle: string | null;
  transformOptions: Record<string, unknown>;
}

interface TemplateRecord {
  id: string;
  ownerId: string | null;
  isPreset: boolean;
  canEdit: boolean;
  name: string;
  description: string;
  settings: TemplateSettings;
  sharedWithTeam: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface VersionSnapshot {
  version: number;
  name: string;
  description: string;
  settings: TemplateSettings;
  sharedWithTeam: boolean;
  createdAt: string;
  createdBy: string;
}

const STYLE_PRESETS = ["Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];

const EMPTY_SETTINGS: TemplateSettings = {
  aspectRatio: "9:16",
  durationSeconds: 30,
  style: STYLE_PRESETS[0],
  transformStyle: null,
  transformOptions: {},
};

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/csrf");
    if (!res.ok) return "";
    const data = (await res.json()) as { csrfToken?: string };
    return data.csrfToken ?? "";
  } catch {
    return "";
  }
}

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (HTTP ${res.status})`;
  } catch {
    return `Request failed (HTTP ${res.status})`;
  }
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"presets" | "mine">("presets");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    sharedWithTeam: false,
    settings: EMPTY_SETTINGS,
  });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<VersionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error(await readApiError(res));
      const body = (await res.json()) as { data: { templates: TemplateRecord[] } | null };
      setTemplates(body.data?.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetch("/api/templates")
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res));
        const body = (await res.json()) as { data: { templates: TemplateRecord[] } | null };
        if (!active) return;
        setTemplates(body.data?.templates ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load templates");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const startCreate = useCallback(() => {
    setEditingId(null);
    setForm({ name: "", description: "", sharedWithTeam: false, settings: EMPTY_SETTINGS });
    setShowForm(true);
  }, []);

  const startEdit = useCallback((template: TemplateRecord) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description,
      sharedWithTeam: template.sharedWithTeam,
      settings: template.settings,
    });
    setShowForm(true);
  }, []);

  const duplicatePreset = useCallback((template: TemplateRecord) => {
    setEditingId(null);
    setForm({
      name: `${template.name} copy`,
      description: template.description,
      sharedWithTeam: false,
      settings: template.settings,
    });
    setShowForm(true);
  }, []);

  const saveTemplate = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const csrfToken = await fetchCsrfToken();
      const editing = templates.find((template) => template.id === editingId);
      const res = await fetch(editingId ? `/api/templates/${editingId}` : "/api/templates", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          settings: form.settings,
          sharedWithTeam: form.sharedWithTeam,
          ...(editingId ? { expectedVersion: editing?.version ?? 1 } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setShowForm(false);
      setEditingId(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [editingId, form, loadTemplates, templates]);

  const deleteTemplate = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch(`/api/templates/${id}`, {
          method: "DELETE",
          headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
        });
        if (!res.ok) throw new Error(await readApiError(res));
        await loadTemplates();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete template");
      }
    },
    [loadTemplates]
  );

  const loadHistory = useCallback(
    async (template: TemplateRecord) => {
      if (historyFor === template.id) {
        setHistoryFor(null);
        return;
      }
      setHistoryFor(template.id);
      setHistory([]);
      setHistoryLoading(true);
      try {
        const versions = Array.from(Array(template.version).keys()).map((index) => index + 1);
        const results = await Promise.all(
          versions.map(async (version) => {
            const res = await fetch(`/api/templates/${template.id}?version=${version}`);
            if (!res.ok) return null;
            const body = (await res.json()) as { data: { template: VersionSnapshot } | null };
            return body.data?.template ?? null;
          })
        );
        setHistory(results.filter((entry): entry is VersionSnapshot => entry !== null).reverse());
      } catch {
        setError("Failed to load template versions");
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyFor]
  );

  const visible = templates.filter((template) =>
    tab === "presets" ? template.isPreset : !template.isPreset
  );

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight sm:text-[32px]">
            Template Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save aspect ratio, duration, and style settings once, then apply them to every upload.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create template
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
          <p className="text-sm text-red-300">{sanitize(error)}</p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveTemplate();
          }}
          className="space-y-5 rounded-2xl border border-white/10 bg-surface p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{editingId ? "Edit template" : "New template"}</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm font-semibold text-muted-foreground hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">Name</span>
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white outline-none focus:border-brand"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">Description</span>
              <input
                maxLength={240}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">Aspect ratio</span>
              <select
                value={form.settings.aspectRatio}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, aspectRatio: e.target.value as AspectRatio },
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white"
              >
                <option value="9:16">9:16 vertical</option>
                <option value="1:1">1:1 square</option>
                <option value="16:9">16:9 landscape</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">Target duration (seconds)</span>
              <input
                type="number"
                min={3}
                max={600}
                required
                value={form.settings.durationSeconds}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, durationSeconds: Number(e.target.value) || 3 },
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white outline-none focus:border-brand"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">Caption style</span>
              <select
                value={form.settings.style}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, style: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white"
              >
                {STYLE_PRESETS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-white/90">AI transform style</span>
              <select
                value={form.settings.transformStyle ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, transformStyle: e.target.value || null },
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2 text-white"
              >
                <option value="">None</option>
                {TRANSFORM_STYLES.map((style) => (
                  <option key={style.name} value={style.name}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.sharedWithTeam}
              onChange={(e) => setForm((prev) => ({ ...prev, sharedWithTeam: e.target.checked }))}
              className="rounded border-white/20"
            />
            <Share2 className="h-4 w-4 text-brand" aria-hidden />
            Share with team members
          </label>

          <button
            type="submit"
            disabled={saving || form.name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {editingId ? "Save new version" : "Create template"}
          </button>
        </form>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Template categories">
        {(["presets", "mine"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === key
                ? "bg-brand text-black"
                : "bg-white/5 text-muted-foreground hover:text-white"
            }`}
          >
            {key === "presets" ? "Presets" : "My templates"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-52 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
          <p className="font-bold">No templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to keep every clip on brand.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const name = sanitize(template.name);
            const description = sanitize(template.description);
            const styleLabel =
              TRANSFORM_STYLES.find((style) => style.name === template.settings.transformStyle)
                ?.label ??
              template.settings.transformStyle ??
              "None";
            return (
              <article
                key={template.id}
                className="flex flex-col rounded-2xl border border-white/10 bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">{name}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {description || "No description"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    v{template.version}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/5 p-2">
                    <dt className="text-muted-foreground">Aspect</dt>
                    <dd className="mt-0.5 font-bold">{template.settings.aspectRatio}</dd>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="mt-0.5 font-bold">{template.settings.durationSeconds}s</dd>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white/5 p-2">
                    <dt className="text-muted-foreground">Style</dt>
                    <dd className="mt-0.5 truncate font-bold">
                      {sanitize(template.settings.style)} · {sanitize(String(styleLabel))}
                    </dd>
                  </div>
                </dl>

                {template.sharedWithTeam && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                    Shared with team
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/upload?template=${encodeURIComponent(template.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-black"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    Use in upload
                  </Link>
                  <button
                    type="button"
                    onClick={() => void loadHistory(template)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/5"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    Versions
                  </button>
                  {template.isPreset ? (
                    <button
                      type="button"
                      onClick={() => duplicatePreset(template)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/5"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Duplicate
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(template)}
                        disabled={!template.canEdit}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/5 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(template.id)}
                        disabled={!template.canEdit}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {historyFor === template.id && (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Version history
                    </h3>
                    {historyLoading ? (
                      <p className="text-xs text-muted-foreground">Loading versions…</p>
                    ) : (
                      history.map((entry) => (
                        <div
                          key={entry.version}
                          className="rounded-xl bg-white/5 px-3 py-2 text-xs"
                        >
                          <span className="font-bold">v{entry.version}</span>{" "}
                          <span className="text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          <p className="mt-0.5 truncate text-white/80">
                            {entry.settings.aspectRatio} · {entry.settings.durationSeconds}s ·{" "}
                            {sanitize(entry.settings.style)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
