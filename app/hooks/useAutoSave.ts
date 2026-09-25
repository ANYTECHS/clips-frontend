"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/app/lib/autosave";

export type SaveStatus = "saved" | "saving" | "unsaved" | "recovered" | "conflict" | "error";
export function useAutoSave<T>(key: string, value: T, options: { onRecover?: (data: T) => void; onConflict?: (draft: Draft<T>) => void; delayMs?: number; retentionMs?: number } = {}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const hydrated = useRef(false);
  const { onRecover, onConflict, delayMs = 800, retentionMs = 7 * 86400000 } = options;
  useEffect(() => { const draft = loadDraft<T>(key, retentionMs); if (draft) { onConflict?.(draft); onRecover?.(draft.data); setStatus("recovered"); } hydrated.current = true; }, [key, onConflict, onRecover, retentionMs]);
  useEffect(() => { if (!hydrated.current) return; setStatus("unsaved"); const timer = window.setTimeout(() => { try { setStatus("saving"); saveDraft(key, value); setStatus("saved"); } catch { setStatus("error"); } }, delayMs); return () => window.clearTimeout(timer); }, [key, value, delayMs]);
  const saveNow = useCallback(() => { saveDraft(key, value); setStatus("saved"); }, [key, value]);
  const discard = useCallback(() => { clearDraft(key); setStatus("saved"); }, [key]);
  return { status, saveNow, discard };
}
