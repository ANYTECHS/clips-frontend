"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { LogOut } from "lucide-react";

export default function Navbar() {
  const { user, setUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full border-b border-border">
      <header className="w-full max-w-7xl mx-auto px-6 py-[22px] flex justify-between items-center z-10 transition-opacity duration-500 relative">
        <Link href="/" className="flex items-center gap-3 text-[19px] font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity">
          <div className="w-[30px] h-[30px] bg-brand rounded-[8px] flex items-center justify-center text-black text-[16px]">
            ⚡
          </div>
          ClipCash
        </Link>
        
        {!user && (
          <nav className="hidden lg:flex gap-10 text-[13px] font-semibold text-muted">
            <Link href="#" className="hover:text-white transition-colors">Features</Link>
            <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="#" className="hover:text-white transition-colors">Showcase</Link>
            <Link href="#" className="hover:text-white transition-colors">Docs</Link>
          </nav>
        )}

        <div className="flex items-center gap-6">
          {!user ? (
            <>
              <Link 
                href="/login"
                className="text-[14px] font-semibold text-white hover:text-brand transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/signup"
                className="bg-brand hover:bg-brand-hover text-black px-6 py-2.5 rounded-full text-[14px] font-bold transition-all shadow-[0_0_15px_rgba(0,229,143,0.15)] hover:shadow-[0_0_25px_rgba(0,229,143,0.3)] transform hover:-translate-y-0.5 inline-block"
              >
                Get Started
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="text-[14px] text-white font-medium px-4 py-2 bg-input border border-subtle rounded-full shadow-sm hover:bg-surface-hover transition-colors"
              >
                {user.profile?.username || user.name || user.email}
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={() => {
                      setUser(null);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-[14px] text-white hover:bg-surface-hover transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-muted" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
