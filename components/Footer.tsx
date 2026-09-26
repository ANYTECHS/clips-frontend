import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
  {
    label: "GitHub",
    href: "https://github.com/clipcash-ai",
    external: true,
  },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Public-facing Footer used on /, /login, and other public pages via LandingLayout.
 *
 * - Logo + tagline on the left
 * - Privacy, Terms, Cookies, GitHub links
 * - Copyright notice
 * - Fully responsive (stacks on mobile)
 */
export default function Footer() {
  return (
    <footer className="relative z-10 w-full border-t border-white/5">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <Link
              href="/"
              className="flex items-center gap-2 group"
              aria-label="ClipCash home"
            >
              <div className="w-7 h-7 rounded-xl bg-brand flex items-center justify-center shadow-[0_4px_12px_rgba(0,229,143,0.3)] group-hover:brightness-110 transition-all">
                <Zap className="w-3.5 h-3.5 text-black" aria-hidden="true" />
              </div>
              <span className="text-[14px] font-black text-white tracking-tight">
                Clips<span className="text-brand">AI</span>
              </span>
            </Link>
            <p className="text-[11px] text-muted">
              © {CURRENT_YEAR} ClipCash. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {FOOTER_LINKS.map(({ label, href, external }) => (
                <li key={href}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="text-[13px] text-muted hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
