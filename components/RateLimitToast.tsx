"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, X } from "lucide-react";

interface RateLimitEvent extends CustomEvent {
  detail: {
    retryAfter: number; // seconds
  };
}

export default function RateLimitToast() {
  const [isVisible, setIsVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const handleRateLimitExceeded = useCallback((event: Event) => {
    const customEvent = event as RateLimitEvent;
    const retryAfter = customEvent.detail?.retryAfter || 60;
    
    setRemainingSeconds(retryAfter);
    setIsVisible(true);
  }, []);

  useEffect(() => {
    window.addEventListener("rate-limit-exceeded", handleRateLimitExceeded as EventListener);
    return () => {
      window.removeEventListener("rate-limit-exceeded", handleRateLimitExceeded as EventListener);
    };
  }, [handleRateLimitExceeded]);

  useEffect(() => {
    if (!isVisible || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, remainingSeconds]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setRemainingSeconds(0);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex items-start gap-3 px-4 py-3 rounded-xl bg-red-600 border border-red-500/40 shadow-xl text-sm font-medium text-white max-w-xs animate-in slide-in-from-right-4 duration-200"
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 leading-snug">
        Too many requests — try again in {remainingSeconds} second{remainingSeconds !== 1 ? "s" : ""}
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
