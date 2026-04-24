"use client";

import React, { useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [urlAnalyzing, setUrlAnalyzing] = useState(false);

  const handleURLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setUrlAnalyzing(true);
    await new Promise(r => setTimeout(r, 1500));
    setUrlAnalyzing(false);
    const emailInput = document.getElementById("auth-email");
    if (emailInput) {
      emailInput.focus();
    } else {
      router.push("/signup");
    }
  };

  return (
    <div 
      className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at 70% 40%, rgba(0,255,156,0.25), transparent 40%),
                     radial-gradient(circle at 30% 80%, rgba(0,255,156,0.15), transparent 50%),
                     var(--color-background)`
      }}
    >
      
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto  px-6 py-12 flex items-center z-10 relative">
        <div className="w-full flex flex-col lg:flex-row  justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-40px]">
          {/* Left side */}
          <div className="flex-1 space-y-4 max-w-[580px] ">
            <div className="inline-flex items-center  gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
              <span className="w-2 h-2 rounded-full bg-brand" style={{ boxShadow: "0 0 10px var(--color-brand)" }} />
              AI CLIPPING V2.0 IS LIVE
            </div>
            
            <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
              Turn 1 long<br/>video into <span className="text-brand">100+</span><br/>
              <span className="text-brand">viral clips</span>
            </h1>
            
            <p className="text-muted text-lg max-w-[400px] leading-[1.6]">
              Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts.
            </p>

            <form onSubmit={handleURLSubmit} className="flex gap-4 w-full">
              <div className="relative flex-1 max-w-[340px] group">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-brand transition-colors" />
                <input 
                  type="url" 
                  placeholder="Paste YouTube or Vimeo URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-surface/60 border border-border rounded-[14px] py-3.5 pl-12 pr-4 text-white placeholder-muted-foreground focus:outline-none focus:border-brand/50 focus:bg-surface transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={urlAnalyzing}
                className="bg-brand hover:bg-brand-hover text-black px-8 py-3.5 rounded-[14px] font-bold text-sm tracking-wide transition-all disabled:opacity-70 flex items-center justify-center gap-2 min-w-[130px] shadow-[0_0_15px_var(--color-brand)]"
              >
                {urlAnalyzing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing</>
                ) : "Clip Now"}
              </button>
            </form>
          </div>

          {/* Right side - Login Modal */}
          <div className="w-full max-w-[340px] flex justify-end">
            <AuthForm mode="login" />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
