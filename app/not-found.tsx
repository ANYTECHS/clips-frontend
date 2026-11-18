"use client";

import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#020D08] text-[#F4F7EF] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold mb-4">404 - Page Not Found</h2>
      <p className="text-[#90A89C] mb-6">Could not find requested resource</p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-[#B6FF4A] text-[#020D08] font-black rounded-full hover:bg-[#c6ff6b] transition-all shadow-[0_0_20px_rgba(57,255,20,0.25)]"
      >
        Return Home
      </Link>
    </div>
  );
}
