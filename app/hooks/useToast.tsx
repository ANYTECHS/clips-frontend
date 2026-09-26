"use client";

import { useCallback, useState } from "react";

type ToastVariant = "success" | "error" | "info";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((text: string, _variant?: ToastVariant) => {
    setMessage(text);
  }, []);

  const ToastEl = message ? <span data-testid="toast">{message}</span> : null;

  return { showToast, ToastEl };
}
