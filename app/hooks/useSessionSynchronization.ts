import { useCallback, useEffect, useRef, useState } from "react";

export type SessionConflict = {
  sessionId: string;
  lastWriteAt: number;
};

type SessionMessage = {
  type: "heartbeat" | "write";
  sessionId: string;
  lastWriteAt: number;
};

const STORAGE_KEY = "clipcash_active_session";
const CHANNEL_NAME = "clipcash-session-sync";
const HEARTBEAT_MS = 5_000;

function now(): number {
  return Date.now();
}

function readSession(): SessionMessage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionMessage) : null;
  } catch {
    return null;
  }
}

function publish(message: SessionMessage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Session sync must never prevent the application from working.
  }
}

/**
 * Coordinates browser tabs for one user. Writes use a timestamp and session ID;
 * the greater timestamp wins, with the session ID as a deterministic tie-breaker.
 */
export function useSessionSynchronization(userId = "anonymous") {
  const sessionId = useRef(`${userId}:${crypto.randomUUID?.() ?? `${now()}-${Math.random()}`}`);
  const [conflict, setConflict] = useState<SessionConflict | null>(null);
  const latestWrite = useRef(0);

  const acceptWrite = useCallback((message: SessionMessage) => {
    if (message.sessionId === sessionId.current) return;
    const isNewer = message.lastWriteAt > latestWrite.current ||
      (message.lastWriteAt === latestWrite.current && message.sessionId > sessionId.current);
    if (!isNewer) return;
    latestWrite.current = message.lastWriteAt;
    setConflict({ sessionId: message.sessionId, lastWriteAt: message.lastWriteAt });
  }, []);

  const markWrite = useCallback(() => {
    const message = { type: "write" as const, sessionId: sessionId.current, lastWriteAt: now() };
    latestWrite.current = message.lastWriteAt;
    publish(message);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clipcash-session-write", { detail: message }));
    }
  }, []);

  useEffect(() => {
    const initial = readSession();
    if (initial) acceptWrite(initial);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    const onMessage = (event: MessageEvent<SessionMessage>) => acceptWrite(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try { acceptWrite(JSON.parse(event.newValue) as SessionMessage); } catch { /* ignore malformed data */ }
      }
    };
    const onCustomEvent = (event: Event) => acceptWrite((event as CustomEvent<SessionMessage>).detail);
    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("clipcash-session-write", onCustomEvent);
    const heartbeat = window.setInterval(() => {
      const message = { type: "heartbeat" as const, sessionId: sessionId.current, lastWriteAt: latestWrite.current || now() };
      channel?.postMessage(message);
      publish(message);
    }, HEARTBEAT_MS);
    return () => {
      window.clearInterval(heartbeat);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("clipcash-session-write", onCustomEvent);
    };
  }, [acceptWrite]);

  return { conflict, markWrite, dismissConflict: () => setConflict(null), sessionId: sessionId.current };
}
