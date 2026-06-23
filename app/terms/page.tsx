import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Terms of Service — ClipCash AI",
  description: "The terms and conditions governing your use of ClipCash AI.",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen text-white font-sans flex flex-col"
      style={{
        background: `radial-gradient(circle at 30% 20%, rgba(0,255,156,0.08), transparent 40%), #050505`,
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
          <h1 className="text-[40px] font-extrabold tracking-tight leading-tight">Terms of Service</h1>
          <p className="text-[#8e9895] text-[15px]">Last updated: January 2025</p>
        </div>

        {/* Placeholder content */}
        <div className="bg-[#0E1512]/60 border border-[#1E2A24] rounded-[20px] p-8 space-y-6 text-[#a1a1aa] text-[15px] leading-relaxed">
          <p>
            By accessing or using ClipCash AI, you agree to be bound by these Terms of Service. Please read
            them carefully before using our platform.
          </p>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using our services, you confirm that you are at least 18 years old
              and agree to these terms. If you do not agree, you may not use ClipCash AI.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">2. Use of Service</h2>
            <p>
              You agree to use ClipCash AI only for lawful purposes and in accordance with these terms.
              You are responsible for all content you upload or distribute through our platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">3. Intellectual Property</h2>
            <p>
              You retain ownership of content you upload. By using ClipCash AI, you grant us a limited
              licence to process your content solely to provide the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">4. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at our discretion if you violate
              these terms or engage in conduct harmful to other users or to ClipCash AI.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">5. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <span className="text-brand">legal@clipcash.ai</span>.
            </p>
          </section>

          <div className="border-t border-[#1E2A24] pt-6 text-[13px] text-[#5A6F65]">
            This is a placeholder page. Full legal content is coming soon.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
