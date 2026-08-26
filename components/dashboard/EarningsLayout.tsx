"use client";

import React from "react";

export default function EarningsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">{children}</main>
  );
}
