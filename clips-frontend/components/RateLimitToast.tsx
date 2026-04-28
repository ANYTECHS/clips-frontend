"use client";

import { useEffect, useState } from "react";

export default function RateLimitToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setMessage(e.detail?.message || "Rate limit exceeded. Please slow down.");
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    window.addEventListener("rate-limit-exceeded", handler as EventListener);
    return () => window.removeEventListener("rate-limit-exceeded", handler as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-error text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in">
      {message}
    </div>
  );
}
