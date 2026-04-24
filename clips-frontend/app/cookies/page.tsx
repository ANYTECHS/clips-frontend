import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Cookie Settings — ClipCash AI",
  description: "Manage your cookie preferences for ClipCash AI.",
};

export default function CookiesPage() {
  return (
    <div
      className="min-h-screen text-white font-sans flex flex-col"
      style={{
        background: `radial-gradient(circle at 60% 30%, rgba(0,255,156,0.08), transparent 40%), #050505`,
      }}
    >
      <Navbar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-16 space-y-10">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] text-[#8e9895] hover:text-white transition-colors"
        >
          ← Back to home
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
            <span className="w-2 h-2 rounded-full bg-brand" style={{ boxShadow: "0 0 10px #00E58F" }} />
            Legal
          </div>
          <h1 className="text-[40px] font-extrabold tracking-tight leading-tight">Cookie Settings</h1>
          <p className="text-[#8e9895] text-[15px]">Last updated: January 2025</p>
        </div>

        {/* Placeholder content */}
        <div className="bg-[#0E1512]/60 border border-[#1E2A24] rounded-[20px] p-8 space-y-6 text-[#a1a1aa] text-[15px] leading-relaxed">
          <p>
            We use cookies and similar tracking technologies to improve your experience on ClipCash AI.
            This page explains what cookies we use and how you can control them.
          </p>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">Essential Cookies</h2>
            <p>
              These cookies are required for the platform to function correctly. They enable core features
              such as authentication and session management. They cannot be disabled.
            </p>
            <div className="flex items-center justify-between bg-[#111815] rounded-xl px-4 py-3 mt-2">
              <span className="text-[14px] font-medium text-white">Essential</span>
              <span className="text-[12px] font-bold text-brand bg-brand/10 px-3 py-1 rounded-full">Always On</span>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">Analytics Cookies</h2>
            <p>
              These cookies help us understand how visitors interact with ClipCash AI so we can improve
              our product. All data is anonymised.
            </p>
            <div className="flex items-center justify-between bg-[#111815] rounded-xl px-4 py-3 mt-2">
              <span className="text-[14px] font-medium text-white">Analytics</span>
              <span className="text-[12px] font-bold text-[#8e9895] bg-white/5 px-3 py-1 rounded-full">Coming soon</span>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">Marketing Cookies</h2>
            <p>
              These cookies are used to show you relevant advertisements. We do not currently use
              third-party marketing cookies.
            </p>
            <div className="flex items-center justify-between bg-[#111815] rounded-xl px-4 py-3 mt-2">
              <span className="text-[14px] font-medium text-white">Marketing</span>
              <span className="text-[12px] font-bold text-[#8e9895] bg-white/5 px-3 py-1 rounded-full">Not used</span>
            </div>
          </section>

          <div className="border-t border-[#1E2A24] pt-6 text-[13px] text-[#5A6F65]">
            Cookie preference controls are coming soon. For now, essential cookies only are used.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
