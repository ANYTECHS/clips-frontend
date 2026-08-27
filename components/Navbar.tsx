"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Zap, Menu, X, User, ChevronDown, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { sanitize } from "@/app/lib/sanitize";
import { DEFAULT_BLUR_PLACEHOLDER, SIZES_AVATAR_SM, SIZES_AVATAR_MD } from "@/app/lib/imageUtils";

/**
 * Public-facing Navbar used on /, /login, /onboarding and other public pages.
 *
 * - Unauthenticated: logo + "Sign In" CTA
 * - Authenticated: logo + user avatar dropdown (dashboard link + sign out)
 * - Responsive: full nav on md+, hamburger menu on mobile
 */
export default function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const displayName = user?.name ?? user?.email ?? "";
  const avatarUrl = user?.avatarUrl ?? null;

  return (
    <header className="relative z-30 w-full">
      <nav
        className="flex items-center justify-between px-6 md:px-10 py-4 w-full max-w-7xl mx-auto"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group shrink-0"
          aria-label="ClipCash home"
        >
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-[0_4px_12px_rgba(0,229,143,0.4)] group-hover:brightness-110 transition-all">
            <Zap className="w-4 h-4 text-black" aria-hidden="true" />
          </div>
          <span className="text-[15px] font-black text-white tracking-tight">
            Clips<span className="text-brand">AI</span>
          </span>
        </Link>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            // Loading skeleton
            <div className="w-24 h-9 rounded-xl bg-surface animate-pulse" aria-hidden="true" />
          ) : user ? (
            // Authenticated — avatar dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="User menu"
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-surface hover:bg-surface-hover transition-colors"
              >
                <AvatarDisplay avatarUrl={avatarUrl} displayName={displayName} size={28} />
                <span className="text-sm font-medium text-white max-w-[140px] truncate">
                  {sanitize(displayName)}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/10 bg-surface shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-semibold text-white truncate">{sanitize(displayName)}</p>
                    {user.email && (
                      <p className="text-[11px] text-muted truncate mt-0.5">{sanitize(user.email)}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted hover:text-white hover:bg-white/5 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Unauthenticated — Sign In CTA
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2 text-sm font-bold text-black shadow-[0_4px_14px_rgba(0,229,143,0.3)] hover:brightness-105 transition-all active:scale-[0.98]"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          className="md:hidden p-2 rounded-xl text-muted hover:text-white hover:bg-surface-hover transition-colors"
        >
          {mobileOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          "fixed top-0 right-0 h-full w-72 max-w-[80vw] z-30 md:hidden",
          "bg-surface border-l border-white/10 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Mobile menu header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 group"
            onClick={() => setMobileOpen(false)}
            aria-label="ClipCash home"
          >
            <div className="w-7 h-7 rounded-xl bg-brand flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" aria-hidden="true" />
            </div>
            <span className="text-[14px] font-black text-white tracking-tight">
              Clips<span className="text-brand">AI</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-xl text-muted hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile menu body */}
        <div className="flex-1 px-4 py-6 space-y-2">
          {isLoading ? (
            <div className="h-10 rounded-xl bg-surface-hover animate-pulse" aria-hidden="true" />
          ) : user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-xl bg-surface-hover border border-white/5">
                <AvatarDisplay avatarUrl={avatarUrl} displayName={displayName} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{sanitize(displayName)}</p>
                  {user.email && (
                    <p className="text-[11px] text-muted truncate">{sanitize(user.email)}</p>
                  )}
                </div>
              </div>

              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
                Dashboard
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-surface-hover transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-black shadow-[0_4px_14px_rgba(0,229,143,0.3)] hover:brightness-105 transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Internal helper ────────────────────────────────────────────────────────

interface AvatarDisplayProps {
  avatarUrl: string | null;
  displayName: string;
  size: number;
}

function AvatarDisplay({ avatarUrl, displayName, size }: AvatarDisplayProps) {
  const initials = getInitials(displayName);

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`${sanitize(displayName)} avatar`}
        width={size}
        height={size}
        sizes={size <= 32 ? SIZES_AVATAR_SM : SIZES_AVATAR_MD}
        placeholder="blur"
        blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0 text-brand font-bold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]?.length >= 1) return parts[0][0].toUpperCase();
  return "";
}
