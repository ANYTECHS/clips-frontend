"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useProcessStore, ProcessState } from "../hooks/useProcessStore";
import { useNotifications } from "../hooks/useNotifications";
import { useWebSocket, WSMessage, SocketStatus } from "../hooks/useWebSocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/progress";

function formatEta(seconds: number | null): string {
  if (seconds === null) return "Calculating...";
  if (seconds <= 0) return "Almost done";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s remaining` : `${s}s remaining`;
}

function StatusDot({ status }: { status: SocketStatus }) {
  const colors: Record<SocketStatus, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-400 animate-pulse",
    disconnected: "bg-zinc-400",
    error: "bg-red-500",
  };
  const labels: Record<SocketStatus, string> = {
    connected: "Live",
    connecting: "Connecting",
    disconnected: "Disconnected",
    error: "Error",
  };
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

function apiBaseFromWs(wsUrl: string) {
  try {
    const u = new URL(wsUrl);
    const proto = u.protocol === "wss:" ? "https:" : "http:";
    return `${proto}//${u.host}`;
  } catch {
    return "";
  }
}

export default function ProcessDashboard() {
  const { process: job, update, startProcess, resetProcess } = useProcessStore();
  const { permission, requestPermission, notify } = useNotifications();
  const notifiedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isProcessing = job.status === "processing";
  const isComplete = job.status === "complete";
  const isIdle = job.status === "idle";

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "progress") {
        update({
          progress: msg.progress,
          momentsFound: msg.momentsFound,
          estimatedSecondsRemaining: msg.estimatedSecondsRemaining,
        });
      } else if (msg.type === "complete") {
        update({
          progress: 100,
          status: "complete",
          completedAt: Date.now(),
          momentsFound: msg.momentsFound,
          estimatedSecondsRemaining: 0,
        });
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          notify("Clips — Processing Complete", `"${job.label}" is ready.`);
        }
      } else if (msg.type === "error") {
        update({ status: "error" });
      }
    },
    [update, notify, job.label]
  );

  const { status: socketStatus } = useWebSocket({
    url: WS_URL,
    enabled: isProcessing,
    onMessage: handleMessage,
  });

  useEffect(() => {
    if (job.progress >= 100 && isProcessing && !notifiedRef.current) {
      notifiedRef.current = true;
      update({ status: "complete", completedAt: Date.now() });
      notify("Clips — Processing Complete", `"${job.label}" is ready.`);
    }
  }, [job.progress, isProcessing, job.label, update, notify]);

  function handleStart() {
    notifiedRef.current = false;
    startProcess(crypto.randomUUID(), "My Clip Export");
  }

  async function cancelJob() {
    setCancelError(null);
    setCancelling(true);
    const base = apiBaseFromWs(WS_URL);
    const url = base ? `${base}/api/jobs/${job.id}/cancel` : `/api/jobs/${job.id}/cancel`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify("Clips — Processing Cancelled", `"${job.label}" has been cancelled.`);
      resetProcess();
      setConfirmOpen(false);
    } catch (e: any) {
      setCancelError("Unable to cancel right now. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Background Processing
          </h2>
          {isProcessing && <StatusDot status={socketStatus} />}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          Processing continues even if you navigate away. Come back anytime to
          check progress.
        </p>

        {!isIdle && (
          <div className="mb-5 flex flex-col gap-3">
            <div>
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                <span>{job.label}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>

            <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Moments found:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {job.momentsFound}
                </span>
              </span>
              {isProcessing && (
                <span>{formatEta(job.estimatedSecondsRemaining)}</span>
              )}
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {isProcessing &&
                socketStatus === "disconnected" &&
                "Reconnecting to server..."}
              {isProcessing &&
                socketStatus !== "disconnected" &&
                "Processing in background — feel free to navigate away."}
              {isComplete && "Done! Your clip is ready."}
              {job.status === "error" && "Something went wrong. Please try again."}
            </p>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          {isIdle && (
            <button
              onClick={handleStart}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Start Processing
            </button>
          )}
          {!isIdle && (
            <>
              <button
                onClick={resetProcess}
                className="rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                aria-haspopup="dialog"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-400 dark:border-zinc-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    aria-hidden
                    className="text-zinc-600 dark:text-zinc-300"
                  >
                    <path
                      d="M3 3l6 6M9 3L3 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Cancel Processing
              </button>
            </>
          )}
        </div>
        {isProcessing && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Closing this window won't stop the processing. Use “Cancel Processing” to stop the job.
          </p>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !cancelling && setConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg"
          >
            <h3 className="text-sm font-semibold text-zinc-50 mb-2">Cancel Processing?</h3>
            <p className="text-sm text-zinc-400">
              Closing this window won't stop the processing. Confirming will request the server to stop the current AI job.
            </p>
            {cancelError && (
              <p className="mt-2 text-xs text-red-400">{cancelError}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={cancelJob}
                disabled={cancelling}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel Job"}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {permission !== "granted" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Get notified when processing completes.
          </p>
          <button
            onClick={requestPermission}
            disabled={permission === "denied"}
            className="shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-50 px-4 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {permission === "denied" ? "Blocked" : "Enable Notifications"}
          </button>
        </div>
      )}
    </div>
  );
}
