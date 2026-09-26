"use client";

import { Bell, Check, CloudUpload, Menu } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef,useState } from "react";

import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { sanitize } from "@/app/lib/sanitize";
import { selectUserName,useUserStore } from "@/app/store";
import PlanUsage from "@/components/dashboard/PlanUsage";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

/**
 * Dashboard header with welcome banner, notification bell, and quick-upload button.
 * Polls notifications every 15 seconds and supports mark-as-read with optimistic updates.
 * Memoized to prevent re-renders from parent layout state changes.
 */
const DashboardHeader = memo(function DashboardHeader({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const userName = useUserStore(selectUserName);
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setNotifications(json.data);
        }
      }
    } catch {
      // Ignore network errors in background polling
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update: remove from the list immediately so the UI feels
    // instant, and restore it if the request turns out to have failed.
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) {
        setNotifications(previous);
      }
    } catch {
      setNotifications(previous);
    }
  };

  const handleMarkAllRead = async () => {
    const previous = notifications;
    const ids = notifications.map((n) => n.id);
    setNotifications([]);

    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/notifications/${id}/read`, { method: "PATCH" }))
    );
    const failedIds = ids.filter((_, i) => {
      const result = results[i];
      return result.status === "rejected" || !result.value.ok;
    });

    if (failedIds.length > 0) {
      // Restore only the notifications that actually failed to mark as read.
      setNotifications(previous.filter((n) => failedIds.includes(n.id)));
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.length;

  return (
    // Stacks until `lg`, not `md` (Issue #1070). The sidebar only becomes
    // static at `lg`, so between 768px and 1023px this row had the full-width
    // heading and the action cluster competing for a ~720px line and
    // overlapping. The two breakpoints have to agree.
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl px-4 sm:px-6 py-5 bg-surface/50 border border-white/5 relative">
      <div className="flex items-start gap-3 min-w-0">
        {/* The only way to reach the sidebar below `lg`. `onMenuClick` was
            accepted as a prop and never rendered, so on every tablet the
            sidebar sat off-canvas with nothing to open it. */}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t("dashboard.open_menu")}
            className="lg:hidden -ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface text-gray-300 transition-colors hover:bg-input hover:text-white"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-white truncate">
            {t("dashboard.welcome", { name: sanitize(userName) })}
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={popoverRef} data-tour="notifications">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={`${t("notifications.title")} ${unreadCount > 0 ? `(${unreadCount} ${t("notifications.unread_count", { count: unreadCount })})` : ""}`}
            className="relative p-2.5 rounded-xl border border-white/10 bg-surface hover:bg-input text-gray-300 hover:text-white transition-colors"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-extrabold text-black shadow-[0_0_8px_var(--color-brand)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {isOpen && (
            <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-surface shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface/80">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {t("notifications.title")}
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    {t("notifications.mark_all_read")}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400">
                    {t("notifications.no_notifications")}
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-white/5 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 text-left">
                        <p className="text-xs font-bold text-white">{sanitize(item.title)}</p>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          {sanitize(item.message)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(item.id)}
                        aria-label={t("notifications.mark_as_read")}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-brand transition-colors shrink-0"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <span data-tour="plan-usage">
          <PlanUsage compact />
        </span>

        <button
          type="button"
          data-tour="quick-upload"
          className="inline-flex items-center gap-2 rounded-xl bg-[#00E68A] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(0,230,138,0.35)] transition hover:brightness-95"
          aria-label={t("dashboard.quick_upload")}
        >
          <CloudUpload className="h-4 w-4" aria-hidden="true" />
          {t("dashboard.quick_upload")}
        </button>
      </div>
    </header>
  );
});

export default DashboardHeader;
