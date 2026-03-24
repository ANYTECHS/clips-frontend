"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react"

interface NavLink {
    label: string;
    href: string;
}

interface TopNavProps {
    /** Pass the authenticated user object or null while loading */
    user?: {
        name: string;
        avatarUrl?: string;
    } | null;
    /** Override the active path (defaults to usePathname()) */
    activePath?: string;
}

const NAV_LINKS: NavLink[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Create Clips", href: "/create" },
    { label: "Library", href: "/library" },
    { label: "Billing", href: "/billing" },
];


function NavItem({
    link,
    isActive,
    onClick,
}: {
    link: NavLink;
    isActive: boolean;
    onClick?: () => void;
}) {
    return (
        <Link
            href={link.href}
            onClick={onClick}
            className={[
                "relative pb-0.75 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C27C]/60 rounded-sm",
                isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white/80",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
        >
            {link.label}

            {/* Green active underline */}
            <span
                className={[
                    "absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#00C27C] origin-left transition-transform duration-200",
                    isActive ? "scale-x-100" : "scale-x-0",
                ].join(" ")}
                aria-hidden="true"
            />
        </Link>
    );
}



function UserAvatar({ user }: { user: TopNavProps["user"] }) {
    const [imgError, setImgError] = useState(false);

    // Loading skeleton
    if (user === undefined) {
        return (
            <div
                className="w-8 h-8 rounded-full bg-white/10 animate-pulse shrink-0"
                aria-label="Loading user profile"
                role="status"
            />
        );
    }

    const initials = user?.name
        ? user.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "?";

    const showAvatar = user?.avatarUrl && !imgError;

    return (
        <button
            type="button"
            className={[
                "relative flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                "ring-2 ring-transparent hover:ring-[#00C27C]/60 focus-visible:ring-[#00C27C]/80",
                "transition-all duration-150 focus-visible:outline-none",
                "overflow-hidden",
                showAvatar ? "bg-transparent" : "bg-[#1A2D22]",
            ].join(" ")}
            aria-label={`User profile${user?.name ? ` – ${user.name}` : ""}`}
        >
            {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <div className="relative w-full h-full">
                    <Image
                        src={user!.avatarUrl as any}
                        alt={user!.name}
                        fill
                        className="object-cover"
                        onError={() => setImgError(true)}
                        onLoadingComplete={(img) => {
                            // Image loaded successfully
                            if (img.naturalWidth === 0) {
                                setImgError(true);
                            }
                        }}
                    />
                </div>
            ) : (
                <span className="text-[11px] font-bold text-[#00C27C] select-none">
                    {initials}
                </span>
            )}
        </button>
    );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
    open,
    onClose,
    activePath,
}: {
    open: boolean;
    onClose: () => void;
    activePath: string;
}) {
    // Lock body scroll when drawer is open
    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                aria-hidden="true"
                className={[
                    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                    open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                ].join(" ")}
            />

            {/* Drawer panel */}
            <nav
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                className={[
                    "fixed top-0 left-0 z-50 h-full w-65 flex flex-col",
                    "bg-[#0B1510] border-r border-white/[0.07]",
                    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    open ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                    <Image src="/images/logo.png" alt="clip logo" height={100} width={400} className=" object-cover w-36 h-auto " />
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C27C]/60 rounded"
                        aria-label="Close menu"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Links */}
                <div className="flex flex-col gap-1 px-3 py-4 flex-1">
                    {NAV_LINKS.map((link) => {
                        const isActive = activePath.startsWith(link.href);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={onClose}
                                aria-current={isActive ? "page" : undefined}
                                className={[
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium tracking-[-0.01em]",
                                    "transition-colors duration-150",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C27C]/60",
                                    isActive
                                        ? "bg-[#00C27C]/10 text-white"
                                        : "text-white/50 hover:bg-white/5 hover:text-white/80",
                                ].join(" ")}
                            >
                                {/* Active dot */}
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C27C] shrink-0" aria-hidden="true" />
                                )}
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Upgrade CTA */}
                <div className="px-4 py-5 border-t border-white/[0.07]">
                    <Link
                        href="/upgrade"
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[#00C27C] text-[#00C27C] text-[13px] font-semibold tracking-[-0.01em] hover:bg-[#00C27C]/10 transition-colors"
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                            <path d="M6.5 1L7.64 4.86L11.5 6L7.64 7.14L6.5 11L5.36 7.14L1.5 6L5.36 4.86L6.5 1Z" fill="currentColor" />
                        </svg>
                        Upgrade Pro
                    </Link>
                </div>
            </nav>
        </>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TopNav({ user, activePath: activePathProp }: TopNavProps) {
    const pathname = usePathname();
    const activePath = activePathProp ?? pathname ?? "/create";

    const [drawerOpen, setDrawerOpen] = useState(false);

    // Close drawer on route change
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    return (
        <>
            <header className="sticky top-0 z-30 w-full">
                {/* Frosted glass bar */}
                <div className="relative flex items-center justify-between h-14 px-4 md:px-6 border-b border-white/[0.07] bg-[#0A0A0ACC] backdrop-blur-xl">

                    <Image src="/images/logo.png" alt="clip logo" height={100} width={400} className=" object-cover w-36 h-auto " />

                    <nav
                        aria-label="Main navigation"
                        className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2"
                    >
                        {NAV_LINKS.map((link) => (
                            <NavItem
                                key={link.href}
                                link={link}
                                isActive={activePath.startsWith(link.href)}
                            />
                        ))}
                    </nav>

                    {/* ── Right: Upgrade + Avatar ──────────────────── */}
                    <div className="flex items-center gap-3 ml-auto">
                        <div className="hidden md:block">
                            <Link
                                href="/upgrade"
                                className={[
                                    "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full",
                                    "border border-[#00C27C] text-[#00C27C] text-[13px] font-semibold tracking-[-0.01em]",
                                    "hover:bg-[#00C27C]/10 active:bg-[#00C27C]/20",
                                    "transition-all duration-150 bg-[#00FF9D1A]",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C27C]/60",
                                    "whitespace-nowrap shrink-0",
                                ].join(" ")}
                            >
                                <Plus size="16" />
                                Upgrade Pro
                            </Link>
                        </div>

                        <UserAvatar user={user} />

                        {/* Mobile hamburger */}
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="md:hidden flex flex-col justify-center gap-1.25 w-8 h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C27C]/60 rounded"
                            aria-label="Open navigation menu"
                            aria-expanded={drawerOpen}
                            aria-controls="mobile-nav-drawer"
                        >
                            <span className="w-4.5 h-[1.5px] bg-white/70 rounded-full" />
                            <span className="w-3.5 h-[1.5px] bg-white/70 rounded-full" />
                            <span className="w-4.5 h-[1.5px] bg-white/70 rounded-full" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile drawer */}
            <MobileDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                activePath={activePath}
            />
        </>
    );
}