'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface CookieConsent {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export default function CookiesPage() {
  const [consent, setConsent] = useState<CookieConsent>({
    essential: true,
    analytics: false,
    marketing: false,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedConsent = localStorage.getItem('cookie-consent')
    if (savedConsent) {
      setConsent(JSON.parse(savedConsent))
    }
  }, [])

  const handleToggle = (key: keyof CookieConsent) => {
    if (key === 'essential') return
    
    const newConsent = { ...consent, [key]: !consent[key] }
    setConsent(newConsent)
    localStorage.setItem('cookie-consent', JSON.stringify(newConsent))
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: newConsent }))
  }

  if (!mounted) return null

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
          <p className="text-[#8e9895] text-[15px]">Manage your privacy preferences</p>
        </div>

        {/* Settings Content */}
        <div className="bg-surface border border-border rounded-[20px] p-8 space-y-8 text-muted text-[15px] leading-relaxed">
          <p>
            We use cookies and similar tracking technologies to improve your experience on ClipCash AI.
            You can control your preferences here.
          </p>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-white font-bold text-[18px]">Essential Cookies</h2>
                <p className="text-sm">
                  Required for the platform to function correctly. They enable core features
                  such as authentication and session management.
                </p>
              </div>
              <div className="w-12 h-6 bg-brand/20 rounded-full relative opacity-50 cursor-not-allowed shrink-0">
                <div className="absolute right-1 top-1 w-4 h-4 bg-brand rounded-full" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-white font-bold text-[18px]">Analytics Cookies</h2>
                <p className="text-sm">
                  These cookies help us understand how visitors interact with ClipCash AI so we can improve
                  our product. All data is anonymised.
                </p>
              </div>
              <button 
                onClick={() => handleToggle('analytics')}
                className={`w-12 h-6 rounded-full relative transition-all shrink-0 ${consent.analytics ? 'bg-brand' : 'bg-border'}`}
                aria-label="Toggle Analytics Cookies"
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${consent.analytics ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-white font-bold text-[18px]">Marketing Cookies</h2>
                <p className="text-sm">
                  These cookies are used to show you relevant advertisements and track marketing campaign performance.
                </p>
              </div>
              <button 
                onClick={() => handleToggle('marketing')}
                className={`w-12 h-6 rounded-full relative transition-all shrink-0 ${consent.marketing ? 'bg-brand' : 'bg-border'}`}
                aria-label="Toggle Marketing Cookies"
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${consent.marketing ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </section>

          <div className="border-t border-border pt-6 text-[13px] text-muted-foreground italic">
            Your preferences are saved locally to your browser. Clearing your browser data will reset these settings.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
