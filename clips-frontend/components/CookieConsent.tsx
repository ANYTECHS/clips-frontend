'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface CookieConsent {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [consent, setConsent] = useState<CookieConsent>({
    essential: true,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    const savedConsent = localStorage.getItem('cookie-consent')
    if (!savedConsent) {
      setIsVisible(true)
    }
  }, [])

  const handleAcceptAll = () => {
    const fullConsent = { essential: true, analytics: true, marketing: true }
    saveConsent(fullConsent)
  }

  const handleSaveCustom = () => {
    saveConsent(consent)
  }

  const saveConsent = (newConsent: CookieConsent) => {
    localStorage.setItem('cookie-consent', JSON.stringify(newConsent))
    setIsVisible(false)
    // Dispatch event for analytics scripts to pick up
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: newConsent }))
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-10 duration-500">
      {!showCustomize ? (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">We use cookies</h3>
          <p className="text-sm text-muted">
            We use cookies to enhance your experience, analyze site traffic, and serve targeted advertisements. 
            Read our <Link href="/cookies" className="text-brand hover:underline">Cookie Policy</Link> for more details.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              onClick={handleAcceptAll}
              className="flex-1 bg-brand hover:bg-brand-hover text-black py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              Accept All
            </button>
            <button 
              onClick={() => setShowCustomize(true)}
              className="flex-1 bg-surface-hover text-white py-2.5 rounded-xl font-bold text-sm border border-border transition-all"
            >
              Customize
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Cookie Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Essential</p>
                <p className="text-xs text-muted-foreground">Required for the site to function.</p>
              </div>
              <div className="w-10 h-5 bg-brand/30 rounded-full relative opacity-50 cursor-not-allowed">
                <div className="absolute right-1 top-1 w-3 h-3 bg-brand rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Analytics</p>
                <p className="text-xs text-muted-foreground">Helps us improve our services.</p>
              </div>
              <button 
                onClick={() => setConsent(prev => ({ ...prev, analytics: !prev.analytics }))}
                className={`w-10 h-5 rounded-full relative transition-colors ${consent.analytics ? 'bg-brand' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${consent.analytics ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Marketing</p>
                <p className="text-xs text-muted-foreground">Used for targeted advertising.</p>
              </div>
              <button 
                onClick={() => setConsent(prev => ({ ...prev, marketing: !prev.marketing }))}
                className={`w-10 h-5 rounded-full relative transition-colors ${consent.marketing ? 'bg-brand' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${consent.marketing ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
          <div className="pt-2">
            <button 
              onClick={handleSaveCustom}
              className="w-full bg-brand hover:bg-brand-hover text-black py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
