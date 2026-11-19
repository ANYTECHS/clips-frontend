"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";

interface NavbarProps {
  variant?: "landing" | "dashboard";
  sticky?: boolean;
}

export default function Navbar({ variant = "landing", sticky = false }: NavbarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const landingLinks = [
    { label: "Pricing", href: "#", disabled: true },
    { label: "Showcase", href: "#", disabled: true },
    { label: "Docs", href: "/docs", disabled: false },
  ];

  const dashboardLinks = [
    { label: "Dashboard", href: "/dashboard", disabled: false },
    { label: "Create Clips", href: "/clips", disabled: false },
  ];

  const isDashboard = variant === "dashboard" || !!user;
  const navLinks = isDashboard ? dashboardLinks : landingLinks;

  return (
    <nav className={`w-full z-50 transition-all duration-300 ${
      sticky ? "sticky top-0 bg-[#020D08]/85 backdrop-blur-xl border-b border-[#0e4d2a]" : "relative border-b border-[#0e4d2a]/60"
    }`}>
      <header className="w-full max-w-7xl mx-auto px-6 py-[22px] flex justify-between items-center z-10 relative">
        <Logo />
        
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            if (link.disabled) {
              return (
                <div
                  key={link.label}
                  className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-[#5A7A6B] cursor-not-allowed select-none py-1"
                  title="Coming soon"
                >
                  <span>{link.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#06351C] border border-[#0e4d2a] text-[#90A89C] font-semibold lowercase tracking-normal">
                    soon
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`text-[13px] font-bold uppercase tracking-wider relative py-1 transition-all duration-300 ${
                  isActive ? "text-[#F4F7EF]" : "text-[#90A89C] hover:text-[#F4F7EF]"
                }`}
              >
                {link.label}
                {isActive && (
                  <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {!user ? (
            <Link 
              href={pathname === "/signup" ? "/" : "/signup"}
              className="bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] px-5 sm:px-6 py-2.5 rounded-full text-[13px] sm:text-[14px] font-black transition-all shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] transform hover:-translate-y-0.5 inline-block"
            >
              {pathname === "/signup" ? "Log In" : "Get Started"}
            </Link>
          ) : (
            <div className="flex items-center gap-4 sm:gap-6">
              

              <div className="relative flex items-center gap-3 ps-4 border-s border-[#0e4d2a]" ref={dropdownRef}>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[13px] font-bold text-[#F4F7EF] leading-none mb-1">
                    {user?.username || user?.profile?.username || user?.fullName || "User"}
                  </span>
                  <span className="text-[11px] font-bold text-[#B6FF4A]">Pro Creator</span>
                </div>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} aria-label="User profile">
                  <UserAvatar user={user} className="hover:border-[#B6FF4A]/40 transition-colors cursor-pointer group" />
                </button>

                {dropdownOpen && (
                  <div className="absolute end-0 top-full mt-4 w-48 bg-[#042413] border border-[#0e4d2a] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <button 
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-[14px] text-[#F4F7EF] hover:bg-[#06351C] transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-[#90A89C]" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-[#90A89C] hover:text-[#F4F7EF] transition-colors p-2"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#B6FF4A]" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden w-full bg-[#031d0f] border-b border-[#0e4d2a] px-6 py-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col space-y-3">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              if (link.disabled) {
                return (
                  <div
                    key={link.label}
                    className="flex items-center justify-between py-2 text-[14px] font-bold uppercase tracking-wider text-[#5A7A6B]"
                  >
                    <span>{link.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06351C] border border-[#0e4d2a] text-[#90A89C] font-semibold lowercase tracking-normal">
                      coming soon
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between py-2 text-[14px] font-bold uppercase tracking-wider transition-colors ${
                    isActive ? "text-[#B6FF4A]" : "text-[#90A89C] hover:text-[#F4F7EF]"
                  }`}
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
