import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — ClipCash AI",
  description: "How ClipCash AI collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div
      className="min-h-screen text-white font-sans flex flex-col"
      style={{
        background: `radial-gradient(circle at 70% 20%, rgba(0,255,156,0.08), transparent 40%), #050505`,
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
          <h1 className="text-[40px] font-extrabold tracking-tight leading-tight">Privacy Policy</h1>
          <p className="text-[#8e9895] text-[15px]">Last updated: January 2025</p>
        </div>

        {/* Placeholder content */}
        <div className="bg-[#0E1512]/60 border border-[#1E2A24] rounded-[20px] p-8 space-y-6 text-[#a1a1aa] text-[15px] leading-relaxed">
          <p>
            ClipCash AI (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our platform.
          </p>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, connect
              a platform, or upload content. This may include your name, email address, and platform credentials.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve our services, process
              transactions, send notifications, and comply with legal obligations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">3. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide
              services. You may request deletion of your data at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-white font-bold text-[18px]">4. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{" "}
              <span className="text-brand">privacy@clipcash.ai</span>.
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
