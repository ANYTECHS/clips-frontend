export type Draft<T> = { version: number; updatedAt: number; data: T };

export function saveDraft<T>(key: string, data: T, version = 1, now = Date.now()): Draft<T> {
  const draft = { version, updatedAt: now, data };
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export function loadDraft<T>(key: string, retentionMs = 7 * 86400000, now = Date.now()): Draft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null") as Draft<T> | null;
    if (!draft || now - draft.updatedAt > retentionMs) { localStorage.removeItem(key); return null; }
    return draft;
  } catch { localStorage.removeItem(key); return null; }
}

export function clearDraft(key: string) { if (typeof window !== "undefined") localStorage.removeItem(key); }
